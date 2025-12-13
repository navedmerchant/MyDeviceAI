/**
 * Remote Connection Manager
 * Manages WebRTC connection to MyDeviceAI-Desktop using p2pcf.rn
 * Implements the P2PCF protocol for communication
 */

import { P2PCF, type Peer } from 'p2pcf.rn';
import type { P2PMessage } from '../types/RemoteConnection';
import { TextDecoder } from '../utils/textdecoder';
import { P2PCF_WORKER_URL } from '../config/Env';

export type ConnectionStatusCallback = (isConnected: boolean) => void;
export type MessageCallback = (message: string) => void;
export type ErrorCallback = (error: string) => void;
export type RetryStatusCallback = (retryCount: number, nextRetryIn: number | null, isRetrying: boolean) => void;

// Protocol constants
const PROTOCOL_VERSION = '1.0.0';
const MIN_COMPATIBLE_VERSION = '1.0.0';
const CLIENT_IMPL = 'mydeviceai-mobile';

// Retry constants
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRY_DELAY = 30000; // 30 seconds
const RETRY_BACKOFF_MULTIPLIER = 1.5;
const MAX_RETRY_ATTEMPTS = 3; // Maximum number of retry attempts

/**
 * Manages remote connection to MyDeviceAI-Desktop
 */
export class RemoteConnectionManager {
  private p2pcf: P2PCF | null = null;
  private desktopPeer: Peer | null = null;
  private roomCode: string | null = null;

  // Callbacks
  private onConnectionChange: ConnectionStatusCallback | null = null;
  private onMessage: MessageCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onRetryStatus: RetryStatusCallback | null = null;

  // Protocol state
  private isHandshakeComplete: boolean = false;
  private protocolCompatible: boolean = false;
  private clientId: string = `mobile-${Date.now()}`;

  // Retry state
  private retryCount: number = 0;
  private retryTimeoutId: NodeJS.Timeout | null = null;
  private shouldRetry: boolean = false;
  private countdownIntervalId: NodeJS.Timeout | null = null;
  private nextRetryTime: number | null = null;

  // Message streaming - Map of prompt ID to streaming state
  private activePrompts: Map<string, {
    buffer: string;
    reasoningBuffer: string;
    isComplete: boolean;
    hasError: boolean;
    error?: string;
    hasStartedReasoning: boolean;
    hasEndedReasoning: boolean;
  }> = new Map();

  constructor() {
    this.cleanup = this.cleanup.bind(this);
  }

  /**
   * Enable automatic retry on connection failures
   */
  enableRetry(): void {
    this.shouldRetry = true;
    this.retryCount = 0;
  }

  /**
   * Disable automatic retry
   */
  disableRetry(): void {
    this.shouldRetry = false;
    this.clearRetryTimers();
  }

  /**
   * Clear all retry timers
   */
  private clearRetryTimers(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    this.nextRetryTime = null;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(): number {
    const delay = Math.min(
      INITIAL_RETRY_DELAY * Math.pow(RETRY_BACKOFF_MULTIPLIER, this.retryCount),
      MAX_RETRY_DELAY
    );
    return Math.floor(delay);
  }

  /**
   * Schedule a retry attempt
   */
  private scheduleRetry(): void {
    if (!this.shouldRetry || !this.roomCode) {
      return;
    }

    // Check if desktop is still available - don't retry if desktop is present
    if (this.p2pcf && this.p2pcf.hasDesktopPeer()) {
      console.log('Desktop peer is still available, skipping retry');
      return;
    }

    // Check if we've exceeded max retry attempts
    if (this.retryCount >= MAX_RETRY_ATTEMPTS) {
      console.log(`Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached. Stopping retries.`);
      this.shouldRetry = false;
      this.onRetryStatus?.(this.retryCount, null, false);
      this.onError?.(`Failed to connect after ${MAX_RETRY_ATTEMPTS} attempts`);
      return;
    }

    this.clearRetryTimers();

    const delay = this.calculateRetryDelay();
    this.nextRetryTime = Date.now() + delay;
    this.retryCount++;

    console.log(`Scheduling retry #${this.retryCount} in ${delay}ms`);

    // Notify retry status with countdown
    this.updateRetryCountdown();

    // Start countdown interval (update every second)
    this.countdownIntervalId = setInterval(() => {
      this.updateRetryCountdown();
    }, 1000);

    // Schedule the actual retry
    this.retryTimeoutId = setTimeout(async () => {
      this.clearRetryTimers();
      console.log(`Attempting retry #${this.retryCount}...`);

      try {
        await this.connect(this.roomCode!, true); // true = is retry
      } catch (error) {
        console.error('Retry failed:', error);
        // scheduleRetry will be called again by the error handler
      }
    }, delay);
  }

  /**
   * Update retry countdown for UI
   */
  private updateRetryCountdown(): void {
    if (!this.nextRetryTime) {
      this.onRetryStatus?.(this.retryCount, null, false);
      return;
    }

    const remaining = Math.max(0, this.nextRetryTime - Date.now());
    this.onRetryStatus?.(this.retryCount, remaining, true);

    // Clear interval if countdown is done
    if (remaining === 0 && this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  /**
   * Connect to desktop using 6-digit room code
   */
  async connect(roomCode: string, isRetry: boolean = false): Promise<void> {
    // Check if we already have a desktop connection - don't create duplicate
    if (this.p2pcf && this.p2pcf.hasDesktopPeer()) {
      console.log('Already connected to desktop, skipping duplicate connection');
      return;
    }

    // Always disconnect old connection before creating new one
    if (this.p2pcf) {
      console.log('Disconnecting old connection before creating new one');
      await this.disconnect();
    }

    try {
      this.roomCode = roomCode;

      // Only reset retry count on manual connection
      if (!isRetry) {
        this.retryCount = 0;
        this.clearRetryTimers();
      }

      // Generate new client ID for each connection attempt
      this.clientId = `mobile-${Date.now()}`;

      // Create mobile client instance
      this.p2pcf = new P2PCF(
        this.clientId,
        roomCode,
        {
          isDesktop: false, // Mobile client mode
          workerUrl: P2PCF_WORKER_URL,
          pollingInterval: 3000, // Poll for desktop every 3s
        }
      );

      // Listen for desktop connection
      this.p2pcf.on('peerconnect', (peer: Peer) => {
        console.log('Connected to desktop:', peer.clientId);
        this.desktopPeer = peer;

        // Reset retry count on successful connection
        this.retryCount = 0;
        this.clearRetryTimers();
        this.onRetryStatus?.(0, null, false);

        this.performHandshake();
      });

      // Listen for desktop disconnection
      this.p2pcf.on('peerclose', (peer: Peer) => {
        console.log('Desktop disconnected:', peer.clientId);
        this.desktopPeer = null;
        this.isHandshakeComplete = false;
        this.protocolCompatible = false;
        this.onConnectionChange?.(false);

        // Schedule retry on disconnection
        if (this.shouldRetry) {
          this.scheduleRetry();
        }
      });

      // Listen for messages from desktop
      this.p2pcf.on('msg', (peer: Peer, data: ArrayBuffer) => {
        this.handleMessage(data);
      });

      // Listen for errors
      this.p2pcf.on('error', (error: Error) => {
        console.error('P2PCF error:', error);
        this.onError?.(error.message);

        // Don't retry on every error - P2PCF handles polling errors internally
        // Only retry if we had a desktop connection and lost it (handled by peerclose)
        // Polling errors while searching for desktop should not trigger retries
      });

      // Start connection and poll for desktop
      await this.p2pcf.start();
      console.log('P2PCF started, polling for desktop...');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to connect:', errorMessage);
      this.onError?.(errorMessage);

      // Schedule retry on initialization failure (e.g., network detection timeout)
      // This is different from polling errors which P2PCF handles internally
      if (this.shouldRetry) {
        this.scheduleRetry();
      }

      throw error;
    }
  }

  /**
   * Perform protocol handshake with desktop
   */
  private async performHandshake(): Promise<void> {
    try {
      // Step 1: Send hello message
      const helloMsg: P2PMessage = {
        t: 'hello',
        clientId: this.clientId,
        impl: CLIENT_IMPL,
        version: PROTOCOL_VERSION,
      };
      this.sendP2PMessage(helloMsg);

      // Step 2: Send version negotiation
      const versionMsg: P2PMessage = {
        t: 'version_negotiate',
        protocolVersion: PROTOCOL_VERSION,
        minCompatibleVersion: MIN_COMPATIBLE_VERSION,
      };
      this.sendP2PMessage(versionMsg);

      // Wait for version_ack (handled in handleMessage)
      // For now, assume compatible after a short delay
      setTimeout(() => {
        if (!this.protocolCompatible && this.desktopPeer) {
          console.log('No version_ack received, assuming compatible');
          this.protocolCompatible = true;
          this.isHandshakeComplete = true;
          this.onConnectionChange?.(true);
        }
      }, 2000);

    } catch (error) {
      console.error('Handshake failed:', error);
      this.onError?.('Protocol handshake failed');
    }
  }

  /**
   * Disconnect from desktop
   */
  async disconnect(): Promise<void> {
    // Disable retry when explicitly disconnecting
    this.shouldRetry = false;
    this.clearRetryTimers();

    if (this.p2pcf) {
      this.p2pcf.destroy();
      this.p2pcf = null;
    }
    this.desktopPeer = null;
    this.roomCode = null;
    this.isHandshakeComplete = false;
    this.protocolCompatible = false;
    this.retryCount = 0;
    this.activePrompts.clear();
    this.onConnectionChange?.(false);
    this.onRetryStatus?.(0, null, false);
  }

  /**
   * Send chat message to desktop and stream response
   * @param messages - Full conversation history in OpenAI format
   */
  async *sendMessage(
    messages: Array<{ role: string; content: string }>,
    _searchMode: boolean,
    _thinkingMode: boolean
  ): AsyncGenerator<string, void, unknown> {
    if (!this.p2pcf || !this.desktopPeer) {
      throw new Error('Not connected to desktop');
    }

    if (!this.isHandshakeComplete || !this.protocolCompatible) {
      throw new Error('Protocol handshake not complete or incompatible');
    }

    try {
      // Generate unique prompt ID
      const promptId = `prompt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Initialize streaming state
      this.activePrompts.set(promptId, {
        buffer: '',
        reasoningBuffer: '',
        isComplete: false,
        hasError: false,
        hasStartedReasoning: false,
        hasEndedReasoning: false,
      });

      // Create prompt message in OpenAI-compatible format
      const promptMsg: P2PMessage = {
        t: 'prompt',
        id: promptId,
        messages: messages,
        // Optional: Add max_tokens if needed
        // max_tokens: 2000,
      };

      // Send prompt to desktop
      this.sendP2PMessage(promptMsg);

      // Stream response tokens
      yield* this.streamResponse(promptId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to send message:', errorMessage);
      this.onError?.(errorMessage);
      throw error;
    }
  }

  /**
   * Stream response chunks from desktop for a specific prompt
   */
  private async *streamResponse(promptId: string): AsyncGenerator<string, void, unknown> {
    const maxWaitTime = 120000; // 2 minutes timeout
    const pollInterval = 50; // Poll every 50ms for responsiveness
    const startTime = Date.now();

    let lastYieldedLength = 0;

    while (true) {
      // Check timeout
      if (Date.now() - startTime > maxWaitTime) {
        this.activePrompts.delete(promptId);
        throw new Error('Response timeout');
      }

      const state = this.activePrompts.get(promptId);
      if (!state) {
        throw new Error('Prompt state lost');
      }

      // Check for errors
      if (state.hasError) {
        this.activePrompts.delete(promptId);
        throw new Error(state.error || 'Unknown error from desktop');
      }

      // Yield new content (both regular and reasoning tokens)
      const fullBuffer = state.reasoningBuffer + state.buffer;
      if (fullBuffer.length > lastYieldedLength) {
        const newContent = fullBuffer.slice(lastYieldedLength);
        lastYieldedLength = fullBuffer.length;
        yield newContent;
      }

      // Check if complete
      if (state.isComplete) {
        this.activePrompts.delete(promptId);
        break;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Handle incoming P2P message from desktop
   */
  private handleMessage(data: ArrayBuffer): void {
    try {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(data);
      const message: P2PMessage = JSON.parse(text);

      console.log('Received P2P message:', message.t, message);

      switch (message.t) {
        case 'hello':
          // Desktop sent hello, acknowledge
          console.log('Desktop hello received:', message);
          break;

        case 'version_ack':
          // Version negotiation response
          if (message.compatible) {
            console.log('Protocol compatible, version:', message.protocolVersion);
            this.protocolCompatible = true;
            this.isHandshakeComplete = true;
            this.onConnectionChange?.(true);
          } else {
            console.error('Protocol incompatible:', message.reason);
            this.onError?.(`Protocol incompatible: ${message.reason || 'Unknown reason'}`);
          }
          break;

        case 'start':
          // Prompt response started
          {
            const state = this.activePrompts.get(message.id);
            if (state) {
              console.log('Prompt response started:', message.id);
            }
          }
          break;

        case 'token':
          // Regular content token
          {
            const state = this.activePrompts.get(message.id);
            if (state) {
              // If we were processing reasoning tokens, close the <think> tag
              if (state.hasStartedReasoning && !state.hasEndedReasoning) {
                state.reasoningBuffer += '</think>';
                state.hasEndedReasoning = true;
              }
              state.buffer += message.tok;
            }
          }
          break;

        case 'reasoning_token':
          // Reasoning/thinking token
          {
            const state = this.activePrompts.get(message.id);
            if (state) {
              // Add opening <think> tag if this is the first reasoning token
              if (!state.hasStartedReasoning) {
                state.reasoningBuffer = '<think>';
                state.hasStartedReasoning = true;
              }
              state.reasoningBuffer += message.tok;
            }
          }
          break;

        case 'end':
          // Prompt completed successfully
          {
            const state = this.activePrompts.get(message.id);
            if (state) {
              // If we were processing reasoning tokens and never got regular tokens, close the <think> tag
              if (state.hasStartedReasoning && !state.hasEndedReasoning) {
                state.reasoningBuffer += '</think>';
                state.hasEndedReasoning = true;
              }
              state.isComplete = true;
              console.log('Prompt completed:', message.id);
            }
          }
          break;

        case 'error':
          // Prompt failed
          {
            const state = this.activePrompts.get(message.id);
            if (state) {
              state.hasError = true;
              state.error = message.message;
              console.error('Prompt error:', message.id, message.message);
            }
          }
          break;

        case 'model_info':
          // Model information response
          console.log('Model info:', message);
          break;

        default:
          console.warn('Unknown P2P message type:', message.t);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  /**
   * Send P2P protocol message to desktop
   */
  private sendP2PMessage(message: P2PMessage): void {
    if (!this.p2pcf || !this.desktopPeer) {
      console.error('Cannot send message: not connected');
      return;
    }

    try {
      const json = JSON.stringify(message);
      this.p2pcf.send(this.desktopPeer, json);
    } catch (error) {
      console.error('Failed to send P2P message:', error);
    }
  }

  /**
   * Check if currently connected to desktop
   */
  isConnected(): boolean {
    return this.desktopPeer !== null && this.isHandshakeComplete && this.protocolCompatible;
  }

  /**
   * Get current room code
   */
  getRoomCode(): string | null {
    return this.roomCode;
  }

  /**
   * Set connection status callback
   */
  setConnectionStatusCallback(callback: ConnectionStatusCallback): void {
    this.onConnectionChange = callback;
  }

  /**
   * Set message callback
   */
  setMessageCallback(callback: MessageCallback): void {
    this.onMessage = callback;
  }

  /**
   * Set error callback
   */
  setErrorCallback(callback: ErrorCallback): void {
    this.onError = callback;
  }

  /**
   * Set retry status callback
   */
  setRetryStatusCallback(callback: RetryStatusCallback): void {
    this.onRetryStatus = callback;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.disconnect();
  }

  /**
   * Convert text to ArrayBuffer
   */
  private textToArrayBuffer(text: string): ArrayBuffer {
    // React Native compatible UTF-8 encoding
    const uint8Array = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      uint8Array[i] = text.charCodeAt(i);
    }
    return uint8Array.buffer;
  }
}

// Singleton instance
let instance: RemoteConnectionManager | null = null;

/**
 * Get singleton instance of RemoteConnectionManager
 */
export function getRemoteConnectionManager(): RemoteConnectionManager {
  if (!instance) {
    instance = new RemoteConnectionManager();
  }
  return instance;
}
