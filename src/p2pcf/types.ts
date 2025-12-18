/**
 * P2PCF Types
 * TypeScript interfaces and types for P2PCF library
 */

/**
 * Configuration options for P2PCF
 */
export interface P2PCFOptions {
  /**
   * Identifies if this peer is the desktop hub
   * Desktop: waits for connections (passive)
   * Mobile: initiates connections (active)
   */
  isDesktop: boolean;

  /**
   * Cloudflare Worker URL for signaling
   */
  workerUrl: string;

  /**
   * WebRTC configuration (STUN/TURN servers)
   * @deprecated Use stunIceServers and turnIceServers instead
   */
  rtcConfig?: any; // RTCConfiguration from WebRTC

  /**
   * STUN servers for direct peer connections
   * Used when neither peer is behind symmetric NAT
   */
  stunIceServers?: any[];

  /**
   * TURN servers for relay connections
   * Used when either peer is behind symmetric NAT
   */
  turnIceServers?: any[];

  /**
   * Polling interval in milliseconds
   * @default 3000
   */
  pollingInterval?: number;
}

/**
 * Represents a peer in the P2P network
 */
export interface Peer {
  /**
   * Unique session ID
   */
  id: string;

  /**
   * Client identifier (user-provided)
   */
  clientId: string;

  /**
   * Whether this peer is a desktop hub
   */
  isDesktop: boolean;
}

/**
 * Event types emitted by P2PCF
 */
export type P2PCFEventType = 'peerconnect' | 'peerclose' | 'msg' | 'error';

/**
 * Event handlers for P2PCF events
 */
export interface P2PCFEvents {
  peerconnect: (peer: Peer) => void;
  peerclose: (peer: Peer) => void;
  msg: (peer: Peer, data: ArrayBuffer) => void;
  error: (error: Error) => void;
}

/**
 * Worker registration payload
 */
export interface WorkerPayload {
  r: string; // room ID
  k: string; // context ID
  d: [string, string, boolean, string, number, string[]]; // peer data: [sessionId, clientId, isSymmetric, dtlsFingerprint, timestamp, reflexiveIPs]
  t: number; // timestamp
  x: number; // expiration
  p: WorkerPackage[]; // packages
  dk?: string; // delete key (used for DELETE requests)
}

/**
 * Package sent to worker (array format expected by worker)
 * Format: [to, from, type, data]
 * - to: destination session ID
 * - from: sender's session ID
 * - type: 'offer' | 'answer' | 'ice'
 * - data: SDP or ICE candidate data
 */
export type WorkerPackage = [string, string, string, any]; // [to, from, type, data]

/**
 * Worker response
 */
export interface WorkerResponse {
  ps: PeerData[]; // discovered peers
  pk: IncomingPackage[]; // packages for this peer
  dk: string; // delete key
}

/**
 * Peer data from worker
 */
export interface PeerData {
  0: string; // sessionId
  1: string; // clientId
  2: boolean; // isSymmetric (symmetric NAT)
  3: string; // dtls fingerprint
  4: number; // timestamp
  5: string[]; // reflexive IPs
}

/**
 * Incoming package from worker
 */
export interface IncomingPackage {
  from: string; // source session ID
  type: 'offer' | 'answer' | 'ice';
  data: any;
}
