/**
 * P2PCF - Peer-to-Peer Cloudflare Library
 * Desktop-hub star topology for React Native and Web
 */

import { EventEmitter } from 'events';
import type {
  P2PCFOptions,
  Peer,
  P2PCFEvents,
  WorkerPayload,
  WorkerPackage,
  WorkerResponse,
  PeerData,
} from './types';
import { generateSessionId, generateUUID } from './utils';
import { P2PCFStorage } from './storage';

// Platform detection and WebRTC imports
const isReactNative =
  typeof navigator !== 'undefined' &&
  (navigator as any)?.product === 'ReactNative';

let RTCPeerConnection: any;
let RTCIceCandidate: any;
let RTCSessionDescription: any;

if (isReactNative) {
  const RNWebRTC = require('react-native-webrtc');
  RTCPeerConnection = RNWebRTC.RTCPeerConnection;
  RTCIceCandidate = RNWebRTC.RTCIceCandidate;
  RTCSessionDescription = RNWebRTC.RTCSessionDescription;
} else {
  // @ts-ignore - Web environment
  RTCPeerConnection = window.RTCPeerConnection;
  // @ts-ignore
  RTCIceCandidate = window.RTCIceCandidate;
  // @ts-ignore
  RTCSessionDescription = window.RTCSessionDescription;
}

/**
 * Default STUN servers for direct connections
 */
const DEFAULT_STUN_ICE: any[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

/**
 * Default TURN servers for relay connections
 * Used when either peer is behind symmetric NAT
 */
const DEFAULT_TURN_ICE: any[] = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * P2PCF Main Class
 */
export class P2PCF extends EventEmitter {
  // Configuration
  private _clientId: string;
  private _roomId: string;
  private _isDesktop: boolean;
  private _workerUrl: string;
  private _rtcConfig: any; // RTCConfiguration from WebRTC (deprecated)
  private _stunIceServers: any[];
  private _turnIceServers: any[];
  private _pollingInterval: number;

  // Session identifiers
  private _sessionId: string;
  private _contextId: string;
  private _deleteKey: string | null = null;

  // Network settings
  private _dtlsFingerprint: string = '';
  private _reflexiveIPs: string[] = [];
  private _isSymmetric: boolean = false;
  private _startTimestamp: number;

  // Peer management
  private _connections: Map<string, any> = new Map(); // sessionId -> RTCPeerConnection
  private _dataChannels: Map<string, any> = new Map(); // sessionId -> RTCDataChannel
  private _peers: Map<string, Peer> = new Map(); // sessionId -> Peer
  private _desktopPeer: Peer | null = null; // For mobile: track desktop
  private _peerSymmetricStatus: Map<string, boolean> = new Map(); // sessionId -> isSymmetric

  // Signaling state
  private _pollingTimer: any = null;
  private _isPolling: boolean = false;
  private _isDestroyed: boolean = false;
  private _pendingPackages: WorkerPackage[] = [];
  private _pendingIceCandidates: Map<string, any[]> = new Map(); // sessionId -> candidates

  constructor(
    clientId: string,
    roomId: string,
    options: { isDesktop: boolean } & Partial<P2PCFOptions>
  ) {
    super();

    // IMPORTANT: Desktop clientId must contain "desktop" (case-insensitive)
    // This convention is used to distinguish desktop from mobile peers
    // Example: "my-desktop-app", "Desktop-1", "DESKTOP_HUB"
    this._clientId = clientId;
    this._roomId = roomId;
    this._isDesktop = options.isDesktop;
    this._workerUrl = options.workerUrl || '';

    // Validate clientId follows desktop naming convention
    const hasDesktopInName = clientId.toLowerCase().includes('desktop');
    if (this._isDesktop && !hasDesktopInName) {
      console.warn(
        `[P2PCF] WARNING: Desktop peer clientId "${clientId}" should contain "desktop" for proper peer discovery`
      );
    } else if (!this._isDesktop && hasDesktopInName) {
      console.warn(
        `[P2PCF] WARNING: Mobile peer clientId "${clientId}" should NOT contain "desktop"`
      );
    }

    // Support legacy rtcConfig or new STUN/TURN configuration
    this._rtcConfig = options.rtcConfig;
    this._stunIceServers = options.stunIceServers || DEFAULT_STUN_ICE;
    this._turnIceServers = options.turnIceServers || DEFAULT_TURN_ICE;
    this._pollingInterval = options.pollingInterval || 3000;

    this._sessionId = generateSessionId();
    // contextId will be loaded asynchronously in start() - use temporary value for now
    this._contextId = '';
    this._startTimestamp = Date.now();

    console.log(
      `[P2PCF] Initialized as ${this._isDesktop ? 'DESKTOP' : 'MOBILE'}`
    );
    console.log(`[P2PCF] Session: ${this._sessionId}`);
    console.log(`[P2PCF] Client: ${this._clientId}`);
    console.log(`[P2PCF] Room: ${this._roomId}`);
  }

  /**
   * Start the P2P connection process
   */
  async start(): Promise<void> {
    if (this._isPolling) {
      console.warn('[P2PCF] Already started');
      return;
    }

    console.log('[P2PCF] Starting...');

    try {
      // Load or generate contextId (persisted across app restarts)
      let contextId = await P2PCFStorage.getContextId();
      if (!contextId) {
        contextId = generateUUID();
        await P2PCFStorage.setContextId(contextId);
        console.log(`[P2PCF] Generated new context ID: ${contextId}`);
      } else {
        console.log(`[P2PCF] Loaded existing context ID: ${contextId}`);
      }
      this._contextId = contextId;

      // Detect network settings using STUN
      await this._detectNetworkSettings();

      // Start polling the worker
      this._startPolling();

      console.log('[P2PCF] Started successfully');
    } catch (error) {
      console.error('[P2PCF] Failed to start:', error);
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Send data to a specific peer
   */
  send(peer: Peer, data: ArrayBuffer | string): void {
    const dataChannel = this._dataChannels.get(peer.id);

    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`[P2PCF] Data channel not ready for peer ${peer.clientId}`);
      return;
    }

    try {
      // Convert string to ArrayBuffer if needed
      const buffer =
        typeof data === 'string' ? new TextEncoder().encode(data) : data;
      dataChannel.send(buffer);
    } catch (error) {
      console.error(`[P2PCF] Failed to send to ${peer.clientId}:`, error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Broadcast data to all connected peers
   */
  broadcast(data: ArrayBuffer | string): void {
    if (this._isDesktop) {
      // Desktop: send to all mobile peers
      for (const peer of this._peers.values()) {
        this.send(peer, data);
      }
    } else {
      // Mobile: send to desktop only
      if (this._desktopPeer) {
        this.send(this._desktopPeer, data);
      } else {
        console.warn('[P2PCF] No desktop peer connected');
      }
    }
  }

  /**
   * Get list of connected peers
   */
  getPeers(): Peer[] {
    return Array.from(this._peers.values());
  }

  /**
   * Check if there is a desktop peer in the room
   * For mobile: returns true if connected to a desktop peer
   * For desktop: returns true (desktop is always present - itself)
   */
  hasDesktopPeer(): boolean {
    if (this._isDesktop) {
      // Desktop peer is always present (itself)
      return true;
    }
    // Mobile: check if we have a desktop peer connection
    return this._desktopPeer !== null;
  }

  /**
   * Cleanup and destroy all connections
   */
  async destroy(): Promise<void> {
    if (this._isDestroyed) {
      return;
    }

    console.log('[P2PCF] Destroying...');
    this._isDestroyed = true;

    // Stop polling
    this._stopPolling();

    // Close all data channels
    for (const [sid, dc] of this._dataChannels) {
      try {
        dc.close();
      } catch (e) {
        console.error(`[P2PCF] Error closing data channel for ${sid}:`, e);
      }
    }
    this._dataChannels.clear();

    // Close all peer connections
    for (const [sid, pc] of this._connections) {
      try {
        pc.close();
      } catch (e) {
        console.error(`[P2PCF] Error closing connection for ${sid}:`, e);
      }
    }
    this._connections.clear();

    // Delete from worker
    if (this._deleteKey) {
      try {
        await this._deleteFromWorker();
      } catch (e) {
        console.error('[P2PCF] Error deleting from worker:', e);
      }
    }

    this._peers.clear();
    this._desktopPeer = null;
    this._peerSymmetricStatus.clear();
    this._pendingPackages = [];
    this._pendingIceCandidates.clear();

    console.log('[P2PCF] Destroyed');
  }

  /**
   * Reset the stored context ID (useful for debugging or getting a fresh identity)
   * This will generate a new context ID on the next start()
   */
  static async resetContextId(): Promise<void> {
    await P2PCFStorage.clearContextId();
    console.log('[P2PCF] Context ID reset - a new one will be generated on next start');
  }

  // ============================================================================
  // ICE SERVER SELECTION
  // ============================================================================

  /**
   * Get RTC configuration based on NAT symmetry
   * Uses TURN servers if either local or remote peer is behind symmetric NAT
   */
  private _getRTCConfig(remoteSessionId?: string): any {
    // If legacy rtcConfig was provided, use it
    if (this._rtcConfig) {
      return this._rtcConfig;
    }

    // Determine if we need TURN servers
    let needsTurn = this._isSymmetric;

    // If we know the remote peer's symmetric status, check it too
    if (remoteSessionId) {
      const remoteIsSymmetric = this._peerSymmetricStatus.get(remoteSessionId);
      if (remoteIsSymmetric !== undefined) {
        needsTurn = needsTurn || remoteIsSymmetric;
      }
    }

    const iceServers = needsTurn ? this._turnIceServers : this._stunIceServers;

    console.log(
      `[P2PCF] Using ${needsTurn ? 'TURN' : 'STUN'} servers (local symmetric: ${this._isSymmetric}, remote symmetric: ${this._peerSymmetricStatus.get(remoteSessionId || '') ?? 'unknown'})`
    );

    return { iceServers };
  }

  // ============================================================================
  // NETWORK DETECTION
  // ============================================================================

  /**
   * Detect network settings using STUN
   */
  private async _detectNetworkSettings(): Promise<void> {
    console.log('[P2PCF] Detecting network settings...');

    return new Promise((resolve, reject) => {
      // Use STUN servers for initial detection (will use TURN for connections later if needed)
      const pc = new RTCPeerConnection({
        iceServers: this._stunIceServers,
      });
      const timeout = setTimeout(() => {
        pc.close();
        reject(new Error('Network detection timeout'));
      }, 10000);

      const candidates: any[] = [];

      pc.onicecandidate = (event: any) => {
        if (event.candidate) {
          const candidate = event.candidate;
          candidates.push(candidate);

          // Extract DTLS fingerprint from SDP (only need to do once)
          if (!this._dtlsFingerprint && pc.localDescription) {
            const match = pc.localDescription.sdp.match(
              /a=fingerprint:sha-256 (.+)/
            );
            if (match) {
              // Convert hex fingerprint to base64 (worker expects 44-char base64)
              const hexFingerprint = match[1].replace(/:/g, '');
              const bytes = new Uint8Array(
                hexFingerprint
                  .match(/.{1,2}/g)!
                  .map((byte: string) => parseInt(byte, 16))
              );
              this._dtlsFingerprint = btoa(String.fromCharCode(...bytes));
              console.log(`[P2PCF] DTLS fingerprint: ${this._dtlsFingerprint}`);
            }
          }
        } else {
          // null candidate means gathering is complete - now analyze all candidates
          clearTimeout(timeout);
          this._analyzeNetworkSettings(candidates);
          pc.close();
          console.log(
            `[P2PCF] Network detection complete: symmetric=${this._isSymmetric}, reflexive IPs=${this._reflexiveIPs.length}`
          );
          resolve();
        }
      };

      // Create a dummy data channel to trigger ICE gathering
      pc.createDataChannel('detect');

      // Create offer to start ICE gathering
      pc.createOffer()
        .then((offer: any) => pc.setLocalDescription(offer))
        .catch((error: Error) => {
          clearTimeout(timeout);
          pc.close();
          reject(error);
        });
    });
  }

  /**
   * Analyze collected ICE candidates to detect network settings
   * Determines if NAT is symmetric and collects reflexive IPs
   */
  private _analyzeNetworkSettings(candidates: any[]): void {
    const reflexiveIPs = new Set<string>();
    const srflxCandidates: Array<{
      address: string;
      port: number;
      relatedPort: number;
    }> = [];

    // First pass: collect srflx candidates
    for (const candidate of candidates) {
      if (candidate.type === 'srflx' && candidate.address) {
        reflexiveIPs.add(candidate.address);
        srflxCandidates.push({
          address: candidate.address,
          port: candidate.port,
          relatedPort: candidate.relatedPort || 0,
        });
      }
    }

    // Store reflexive IPs
    this._reflexiveIPs = Array.from(reflexiveIPs);

    // Symmetric NAT detection:
    // Network is symmetric if we find two srflx candidates that have:
    // - Same related port (same local port)
    // - Different external ports (NAT assigns different ports per destination)
    // This indicates the NAT is remapping ports based on destination
    let isSymmetric = false;

    for (let i = 0; i < srflxCandidates.length; i++) {
      const c1 = srflxCandidates[i];
      if (!c1) continue;

      for (let j = i + 1; j < srflxCandidates.length; j++) {
        const c2 = srflxCandidates[j];
        if (!c2) continue;

        if (
          c1.relatedPort === c2.relatedPort &&
          c1.port !== c2.port &&
          c1.relatedPort !== 0
        ) {
          isSymmetric = true;
          console.log(
            `[P2PCF] Symmetric NAT detected: same local port ${c1.relatedPort}, different external ports ${c1.port} vs ${c2.port}`
          );
          break;
        }
      }
      if (isSymmetric) break;
    }

    this._isSymmetric = isSymmetric;

    if (this._reflexiveIPs.length > 0) {
      console.log(`[P2PCF] Reflexive IPs: ${this._reflexiveIPs.join(', ')}`);
    }
  }

  // ============================================================================
  // WORKER COMMUNICATION
  // ============================================================================

  /**
   * Start polling the Cloudflare worker
   */
  private _startPolling(): void {
    if (this._isPolling) {
      return;
    }

    this._isPolling = true;
    this._poll();
  }

  /**
   * Stop polling
   */
  private _stopPolling(): void {
    this._isPolling = false;
    if (this._pollingTimer) {
      clearTimeout(this._pollingTimer);
      this._pollingTimer = null;
    }
  }

  /**
   * Poll the worker
   */
  private async _poll(): Promise<void> {
    if (!this._isPolling || this._isDestroyed) {
      return;
    }

    try {
      const response = await this._sendToWorker();
      this._handleWorkerResponse(response);
    } catch (error) {
      console.error('[P2PCF] Poll error:', error);
      this.emit(
        'error',
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Schedule next poll
    if (this._isPolling && !this._isDestroyed) {
      this._pollingTimer = setTimeout(() => {
        this._poll();
      }, this._pollingInterval);
    }
  }

  /**
   * Send data to Cloudflare worker
   */
  private async _sendToWorker(): Promise<WorkerResponse> {
    const payload: WorkerPayload = {
      r: this._roomId,
      k: this._contextId,
      d: [
        this._sessionId,
        this._clientId,
        this._isSymmetric,
        this._dtlsFingerprint,
        this._startTimestamp,
        this._reflexiveIPs,
      ],
      t: Date.now(),
      x: 60000, // 1 minute in milliseconds
      p: this._pendingPackages,
    };

    // DEBUG: Log outgoing packages
    if (this._pendingPackages.length > 0) {
      console.log(
        `[P2PCF] Sending ${this._pendingPackages.length} packages to worker:`,
        this._pendingPackages
          .map((p) => `${p[2]} from ${p[1]} -> ${p[0]}`)
          .join(', ')
      );
    }

    // Clear pending packages
    this._pendingPackages = [];

    const response = await fetch(this._workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Worker request failed: ${response.status}`);
    }

    const data = await response.json();
    return data as WorkerResponse;
  }

  /**
   * Delete from worker on cleanup
   */
  private async _deleteFromWorker(): Promise<void> {
    if (!this._deleteKey) {
      return;
    }

    const payload: WorkerPayload = {
      r: this._roomId,
      k: this._contextId,
      d: [
        this._sessionId,
        this._clientId,
        this._isSymmetric,
        this._dtlsFingerprint,
        this._startTimestamp,
        this._reflexiveIPs,
      ],
      t: Date.now(),
      x: 60000, // 1 minute in milliseconds
      p: [],
      dk: this._deleteKey,
    };

    const response = await fetch(this._workerUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive: true, // Ensure request completes even during page unload
    });

    if (!response.ok) {
      console.warn(`[P2PCF] Delete request failed: ${response.status}`);
    }
  }

  /**
   * Handle worker response
   */
  private _handleWorkerResponse(response: WorkerResponse): void {
    // Store delete key
    if (response.dk) {
      this._deleteKey = response.dk;
    }

    // DEBUG: Log full worker response
    console.log(
      `[P2PCF] Worker response: peers=${response.ps?.length || 0}, packages=${response.pk?.length || 0}`
    );
    if (response.pk && response.pk.length > 0) {
      console.log('[P2PCF] Incoming packages:', JSON.stringify(response.pk));
    }

    // Process discovered peers
    if (response.ps && response.ps.length > 0) {
      this._processPeers(response.ps);
    }

    // Process incoming packages
    if (response.pk && response.pk.length > 0) {
      this._processPackages(response.pk);
    }
  }

  /**
   * Process discovered peers
   * Convention: Desktop peers must have "desktop" in their clientId (case-insensitive)
   */
  private _processPeers(peerDataList: PeerData[]): void {
    if (this._isDesktop) {
      // Desktop: store discovered mobile peers (they will initiate connections)
      for (const peerData of peerDataList) {
        const sessionId = peerData[0];
        const clientId = peerData[1];
        const isSymmetric = peerData[2];

        // Store symmetric NAT status for this peer
        this._peerSymmetricStatus.set(sessionId, isSymmetric);

        // Filter: only track peers that DON'T have "desktop" in their clientId
        // (mobile peers will initiate connections to desktop)
        const isDesktopPeer = clientId.toLowerCase().includes('desktop');
        if (!isDesktopPeer && !this._peers.has(sessionId)) {
          console.log(
            `[P2PCF] Discovered mobile peer: ${clientId} (${sessionId}, symmetric: ${isSymmetric})`
          );
          // Store peer metadata so it's available when data channel opens
          this._peers.set(sessionId, {
            id: sessionId,
            clientId,
            isDesktop: false,
          });
        }
      }
    } else {
      // Mobile: look for desktop peer (clientId contains "desktop")
      for (const peerData of peerDataList) {
        const sessionId = peerData[0];
        const clientId = peerData[1];
        const isSymmetric = peerData[2];

        // Store symmetric NAT status for this peer
        this._peerSymmetricStatus.set(sessionId, isSymmetric);

        // Filter: only connect to peer that has "desktop" in clientId
        const isDesktopPeer = clientId.toLowerCase().includes('desktop');
        if (isDesktopPeer && !this._desktopPeer) {
          console.log(
            `[P2PCF] Found desktop peer: ${clientId} (${sessionId}, symmetric: ${isSymmetric})`
          );

          const peer: Peer = {
            id: sessionId,
            clientId,
            isDesktop: true,
          };

          this._desktopPeer = peer;
          this._connectToDesktop(peer);
        }
      }
    }
  }

  /**
   * Process incoming packages (ICE/SDP)
   * Worker returns packages as arrays: [to, from, type, data]
   * - to: our session ID (recipient)
   * - from: sender's session ID
   * - type: 'offer' | 'answer' | 'ice'
   * - data: SDP or ICE candidate
   */
  private _processPackages(packages: any[]): void {
    for (const pkg of packages) {
      const to = pkg[0]; // Our session ID (recipient)
      const from = pkg[1]; // Sender's session ID
      const type = pkg[2] as 'offer' | 'answer' | 'ice';
      const data = pkg[3];

      console.log(`[P2PCF] Received ${type} from ${from} (to: ${to})`);

      if (type === 'offer') {
        this._handleOffer(from, data);
      } else if (type === 'answer') {
        this._handleAnswer(from, data);
      } else if (type === 'ice') {
        this._handleRemoteIceCandidate(from, data);
      }
    }
  }

  // ============================================================================
  // DESKTOP MODE (Passive - Answer offers)
  // ============================================================================

  /**
   * Handle incoming offer from mobile peer (Desktop mode)
   */
  private async _handleOffer(sessionId: string, offerData: any): Promise<void> {
    console.log(`[P2PCF] Handling offer from ${sessionId}`);

    try {
      // Create peer connection with appropriate ICE servers
      const pc = new RTCPeerConnection(this._getRTCConfig(sessionId));
      this._connections.set(sessionId, pc);

      // Setup event handlers
      this._setupPeerConnectionHandlers(sessionId, pc, false);

      // Set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(offerData));

      // Add any pending ICE candidates
      const pendingIce = this._pendingIceCandidates.get(sessionId) || [];
      for (const candidate of pendingIce) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this._pendingIceCandidates.delete(sessionId);

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer to mobile via worker
      this._sendPackageToWorker(sessionId, 'answer', answer);

      console.log(`[P2PCF] Sent answer to ${sessionId}`);
    } catch (error) {
      console.error(`[P2PCF] Error handling offer from ${sessionId}:`, error);
      this.emit('error', error as Error);
    }
  }

  // ============================================================================
  // MOBILE MODE (Active - Create offers)
  // ============================================================================

  /**
   * Connect to desktop peer (Mobile mode)
   */
  private async _connectToDesktop(peer: Peer): Promise<void> {
    console.log(`[P2PCF] Connecting to desktop ${peer.clientId}`);

    try {
      // Create peer connection with appropriate ICE servers
      const pc = new RTCPeerConnection(this._getRTCConfig(peer.id));
      this._connections.set(peer.id, pc);

      // Setup event handlers
      this._setupPeerConnectionHandlers(peer.id, pc, true);

      // Create data channel (mobile initiates)
      const dc = pc.createDataChannel('data');
      this._setupDataChannel(peer.id, dc, peer);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to desktop via worker
      this._sendPackageToWorker(peer.id, 'offer', offer);

      console.log(`[P2PCF] Sent offer to desktop ${peer.clientId}`);
    } catch (error) {
      console.error(`[P2PCF] Error connecting to desktop:`, error);
      this.emit('error', error as Error);
    }
  }

  /**
   * Handle incoming answer from desktop (Mobile mode)
   */
  private async _handleAnswer(
    sessionId: string,
    answerData: any
  ): Promise<void> {
    console.log(`[P2PCF] Handling answer from ${sessionId}`);

    try {
      const pc = this._connections.get(sessionId);
      if (!pc) {
        console.warn(`[P2PCF] No peer connection for ${sessionId}`);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answerData));

      // Add any pending ICE candidates
      const pendingIce = this._pendingIceCandidates.get(sessionId) || [];
      for (const candidate of pendingIce) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this._pendingIceCandidates.delete(sessionId);

      console.log(`[P2PCF] Connection establishing with ${sessionId}`);
    } catch (error) {
      console.error(`[P2PCF] Error handling answer from ${sessionId}:`, error);
      this.emit('error', error as Error);
    }
  }

  // ============================================================================
  // PEER CONNECTION & DATA CHANNEL
  // ============================================================================

  /**
   * Setup peer connection event handlers
   */
  private _setupPeerConnectionHandlers(
    sessionId: string,
    pc: any,
    isInitiator: boolean
  ): void {
    // ICE candidate handler
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        console.log(`[P2PCF] Local ICE candidate for ${sessionId}`);
        this._sendPackageToWorker(sessionId, 'ice', event.candidate);
      }
    };

    // Connection state change
    pc.onconnectionstatechange = () => {
      console.log(
        `[P2PCF] Connection state for ${sessionId}: ${pc.connectionState}`
      );

      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this._handlePeerDisconnection(sessionId);
      }
    };

    // Data channel handler (for desktop receiving from mobile)
    if (!isInitiator) {
      pc.ondatachannel = (event: any) => {
        console.log(`[P2PCF] Received data channel from ${sessionId}`);

        // Get peer info (should already be stored from _processPeers)
        const peer = this._peers.get(sessionId);
        if (!peer) {
          console.warn(`[P2PCF] No peer metadata found for ${sessionId}`);
          return;
        }

        this._setupDataChannel(sessionId, event.channel, peer);
      };
    }
  }

  /**
   * Setup data channel handlers
   */
  private _setupDataChannel(sessionId: string, dc: any, peer: Peer): void {
    this._dataChannels.set(sessionId, dc);

    dc.onopen = () => {
      console.log(`[P2PCF] Data channel open with ${peer.clientId}`);
      this._peers.set(sessionId, peer);

      // Stop polling on mobile once connected to desktop
      if (!this._isDesktop && peer.isDesktop) {
        console.log('[P2PCF] Mobile connected to desktop - stopping polling');
        this._stopPolling();
      }

      this.emit('peerconnect', peer);
    };

    dc.onclose = () => {
      console.log(`[P2PCF] Data channel closed with ${peer.clientId}`);
      this._handlePeerDisconnection(sessionId);
    };

    dc.onerror = (error: any) => {
      console.error(`[P2PCF] Data channel error with ${peer.clientId}:`, error);
      // RTCErrorEvent has the actual error nested under the 'error' property
      const errorMessage =
        error?.error?.message || error?.message || 'Unknown data channel error';
      this.emit('error', new Error(`Data channel error: ${errorMessage}`));
    };

    dc.onmessage = (event: any) => {
      try {
        const data = event.data;
        this.emit('msg', peer, data);
      } catch (error) {
        console.error(
          `[P2PCF] Error handling message from ${peer.clientId}:`,
          error
        );
        this.emit('error', error as Error);
      }
    };
  }

  /**
   * Handle peer disconnection
   */
  private _handlePeerDisconnection(sessionId: string): void {
    const peer = this._peers.get(sessionId);
    if (!peer) {
      return;
    }

    console.log(`[P2PCF] Peer disconnected: ${peer.clientId}`);

    // Clean up
    const dc = this._dataChannels.get(sessionId);
    if (dc) {
      try {
        dc.close();
      } catch (e) {}
      this._dataChannels.delete(sessionId);
    }

    const pc = this._connections.get(sessionId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this._connections.delete(sessionId);
    }

    this._peers.delete(sessionId);
    this._peerSymmetricStatus.delete(sessionId);

    if (this._desktopPeer?.id === sessionId) {
      this._desktopPeer = null;

      // Resume polling on mobile when desktop disconnects
      if (!this._isDesktop && !this._isDestroyed) {
        console.log(
          '[P2PCF] Mobile lost desktop connection - resuming polling'
        );
        this._startPolling();
      }
    }

    this.emit('peerclose', peer);
  }

  /**
   * Handle remote ICE candidate
   */
  private async _handleRemoteIceCandidate(
    sessionId: string,
    candidateData: any
  ): Promise<void> {
    const pc = this._connections.get(sessionId);

    if (!pc) {
      // Store for later if we don't have a connection yet
      if (!this._pendingIceCandidates.has(sessionId)) {
        this._pendingIceCandidates.set(sessionId, []);
      }
      this._pendingIceCandidates.get(sessionId)!.push(candidateData);
      return;
    }

    if (!pc.remoteDescription) {
      // Store for later if we don't have remote description yet
      if (!this._pendingIceCandidates.has(sessionId)) {
        this._pendingIceCandidates.set(sessionId, []);
      }
      this._pendingIceCandidates.get(sessionId)!.push(candidateData);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidateData));
      console.log(`[P2PCF] Added remote ICE candidate for ${sessionId}`);
    } catch (error) {
      console.error(
        `[P2PCF] Error adding ICE candidate for ${sessionId}:`,
        error
      );
    }
  }

  /**
   * Send package to worker
   * Format: [to, from, type, data]
   */
  private _sendPackageToWorker(
    to: string,
    type: 'offer' | 'answer' | 'ice',
    data: any
  ): void {
    console.log(`[P2PCF] Queueing ${type} package to ${to}`);
    this._pendingPackages.push([to, this._sessionId, type, data]);
  }

  // ============================================================================
  // TYPESCRIPT EVENT EMITTER OVERRIDES
  // ============================================================================

  on<K extends keyof P2PCFEvents>(event: K, listener: P2PCFEvents[K]): this {
    return super.on(event, listener as any);
  }

  emit<K extends keyof P2PCFEvents>(
    event: K,
    ...args: Parameters<P2PCFEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }

  off<K extends keyof P2PCFEvents>(event: K, listener: P2PCFEvents[K]): this {
    return super.off(event, listener as any);
  }

  once<K extends keyof P2PCFEvents>(event: K, listener: P2PCFEvents[K]): this {
    return super.once(event, listener as any);
  }
}

export default P2PCF;
