/**
 * Remote Connection Type Definitions
 * Defines types for WebRTC remote connection to MyDeviceAI-Desktop
 */

/**
 * Connection status representing current state of local and remote connections
 */
export type ConnectionStatus =
  | 'local_loading'      // Local model is loading
  | 'local_ready'        // Local model ready, not connected to remote
  | 'remote_connecting'  // Attempting to connect to remote desktop
  | 'remote_connected'   // Successfully connected to remote desktop
  | 'remote_error';      // Remote connection failed/error

/**
 * Connection mode preference
 */
export type ConnectionMode = 'local' | 'dynamic';

/**
 * Configuration for remote connection
 */
export interface RemoteConnectionConfig {
  roomCode: string;  // 6-digit pairing code
}

/**
 * Message protocol for remote communication
 */
export interface RemoteMessage {
  type: 'chat' | 'response' | 'error' | 'status';
  content: string;
  timestamp: number;
  metadata?: {
    searchMode?: boolean;
    thinkingMode?: boolean;
    model?: string;
    isStreaming?: boolean;
  };
}

/**
 * Remote connection state
 */
export interface RemoteConnectionState {
  status: ConnectionStatus;
  config: RemoteConnectionConfig | null;
  mode: ConnectionMode;
  isConnected: boolean;
  lastError: string | null;
  connectedAt: number | null;
}

/**
 * P2PCF Protocol Messages
 * Binary-safe JSON protocol for communication with desktop
 */
export type P2PMessage =
  | { t: 'hello'; clientId: string; impl: string; version: string }
  | { t: 'version_negotiate'; protocolVersion: string; minCompatibleVersion: string }
  | { t: 'version_ack'; compatible: boolean; protocolVersion: string; reason?: string }
  | { t: 'prompt'; id: string; messages: Array<{ role: string; content: string }>; max_tokens?: number }
  | { t: 'get_model' }
  | { t: 'model_info'; id: string; displayName: string; installed: boolean }
  | { t: 'start'; id: string }
  | { t: 'token'; id: string; tok: string }
  | { t: 'reasoning_token'; id: string; tok: string }
  | { t: 'end'; id: string }
  | { t: 'error'; id: string; message: string }
  | { t: string; [k: string]: any };

/**
 * Context type for RemoteConnectionContext
 */
export interface RemoteConnectionContextType {
  state: RemoteConnectionState;
  connect: (roomCode: string, saveConfig?: boolean) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (
    messages: Array<{ role: string; content: string }>,
    searchMode: boolean,
    thinkingMode: boolean
  ) => AsyncGenerator<string, void, unknown>;
  setMode: (mode: ConnectionMode) => Promise<void>;
  updateLocalModelStatus: (isLoading: boolean) => void;
}
