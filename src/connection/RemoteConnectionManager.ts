/**
 * Remote Connection Manager
 * Manages WebRTC connection to MyDeviceAI-Desktop using p2pcf.rn
 * Implements the P2PCF protocol for communication
 */

import { P2PCF, type Peer } from 'p2pcf.rn';
import type { P2PMessage } from '../types/RemoteConnection';

export type ConnectionStatusCallback = (isConnected: boolean) => void;
export type MessageCallback = (message: string) => void;
export type ErrorCallback = (error: string) => void;

// Protocol constants
const PROTOCOL_VERSION = '1.0.0';
const MIN_COMPATIBLE_VERSION = '1.0.0';
const CLIENT_IMPL = 'mydeviceai-mobile';

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

  // Protocol state
  private isHandshakeComplete: boolean = false;
  private protocolCompatible: boolean = false;
  private clientId: string = `mobile-${Date.now()}`;

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
   * Connect to desktop using 6-digit room code
   */
  async connect(roomCode: string): Promise<void> {
    if (this.p2pcf) {
      await this.disconnect();
    }

    try {
      this.roomCode = roomCode;
      this.clientId = `mobile-${Date.now()}`;

      // Create mobile client instance
      this.p2pcf = new P2PCF(
        this.clientId,
        roomCode,
        {
          isDesktop: false, // Mobile client mode
          workerUrl: 'https://p2pcf.naved-merchant.workers.dev',
          pollingInterval: 3000, // Poll for desktop every 3s
        }
      );

      // Listen for desktop connection
      this.p2pcf.on('peerconnect', (peer: Peer) => {
        console.log('Connected to desktop:', peer.clientId);
        this.desktopPeer = peer;
        this.performHandshake();
      });

      // Listen for desktop disconnection
      this.p2pcf.on('peerclose', (peer: Peer) => {
        console.log('Desktop disconnected:', peer.clientId);
        this.desktopPeer = null;
        this.isHandshakeComplete = false;
        this.protocolCompatible = false;
        this.onConnectionChange?.(false);
      });

      // Listen for messages from desktop
      this.p2pcf.on('msg', (peer: Peer, data: ArrayBuffer) => {
        this.handleMessage(data);
      });

      // Listen for errors
      this.p2pcf.on('error', (error: Error) => {
        console.error('P2PCF error:', error);
        this.onError?.(error.message);
      });

      // Start connection and poll for desktop
      await this.p2pcf.start();
      console.log('P2PCF started, polling for desktop...');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to connect:', errorMessage);
      this.onError?.(errorMessage);
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
    if (this.p2pcf) {
      this.p2pcf.destroy();
      this.p2pcf = null;
    }
    this.desktopPeer = null;
    this.roomCode = null;
    this.isHandshakeComplete = false;
    this.protocolCompatible = false;
    this.activePrompts.clear();
    this.onConnectionChange?.(false);
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
      const text = this.arrayBufferToText(data);
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
      const data = this.textToArrayBuffer(json);
      this.p2pcf.broadcast(data);
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

  /**
   * Convert ArrayBuffer to text
   */
  private arrayBufferToText(buffer: ArrayBuffer): string {
    // React Native compatible UTF-8 decoding
    const uint8Array = new Uint8Array(buffer);
    return String.fromCharCode(...uint8Array);
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
