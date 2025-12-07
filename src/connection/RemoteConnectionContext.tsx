/**
 * Remote Connection Context
 * Provides remote connection state and methods throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  RemoteConnectionContextType,
  RemoteConnectionState,
  ConnectionMode,
  ConnectionStatus,
} from '../types/RemoteConnection';
import { getRemoteConnectionManager } from './RemoteConnectionManager';

// AsyncStorage keys
const STORAGE_KEYS = {
  ROOM_CODE: 'remoteRoomCode',
  MODE: 'remoteConnectionMode',
};

// Initial state
const initialState: RemoteConnectionState = {
  status: 'local_loading',
  config: null,
  mode: 'local',
  isConnected: false,
  lastError: null,
  connectedAt: null,
  retryCount: 0,
  nextRetryIn: null,
  isRetrying: false,
};

// Create context
const RemoteConnectionContext = createContext<RemoteConnectionContextType | undefined>(undefined);

/**
 * Remote Connection Provider Component
 */
export function RemoteConnectionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RemoteConnectionState>(initialState);
  const connectionManager = getRemoteConnectionManager();

  /**
   * Load saved configuration from AsyncStorage
   */
  const loadSavedConfig = useCallback(async () => {
    try {
      const [savedRoomCode, savedMode] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ROOM_CODE),
        AsyncStorage.getItem(STORAGE_KEYS.MODE),
      ]);

      const mode = (savedMode as ConnectionMode) || 'local';

      setState(prev => ({
        ...prev,
        mode,
        config: savedRoomCode ? { roomCode: savedRoomCode } : null,
      }));

      // Auto-reconnect if dynamic mode and we have a saved room code
      if (mode === 'dynamic' && savedRoomCode) {
        console.log('Auto-reconnecting to room:', savedRoomCode);
        await connect(savedRoomCode, false); // false = don't save again
      }
    } catch (error) {
      console.error('Failed to load remote connection config:', error);
    }
  }, []);

  /**
   * Set up connection manager callbacks
   */
  useEffect(() => {
    connectionManager.setConnectionStatusCallback((isConnected) => {
      setState(prev => ({
        ...prev,
        status: isConnected ? 'remote_connected' :
                prev.isRetrying ? 'remote_retrying' :
                prev.mode === 'dynamic' ? 'local_ready' : prev.status,
        isConnected,
        connectedAt: isConnected ? Date.now() : null,
        lastError: isConnected ? null : prev.lastError,
      }));
    });

    connectionManager.setErrorCallback((error) => {
      setState(prev => ({
        ...prev,
        status: prev.isRetrying ? 'remote_retrying' : 'remote_error',
        lastError: error,
      }));
    });

    connectionManager.setRetryStatusCallback((retryCount, nextRetryIn, isRetrying) => {
      setState(prev => ({
        ...prev,
        retryCount,
        nextRetryIn,
        isRetrying,
        status: isRetrying ? 'remote_retrying' :
                prev.isConnected ? 'remote_connected' :
                prev.mode === 'dynamic' ? 'local_ready' : prev.status,
      }));
    });

    // Load saved configuration on mount
    loadSavedConfig();

    return () => {
      // Cleanup on unmount
      connectionManager.disconnect();
    };
  }, [connectionManager, loadSavedConfig]);

  /**
   * Connect to desktop using room code
   */
  const connect = useCallback(async (roomCode: string, saveConfig = true) => {
    try {
      setState(prev => ({
        ...prev,
        status: 'remote_connecting',
        lastError: null,
      }));

      // Enable automatic retry for dynamic mode connections
      connectionManager.enableRetry();
      await connectionManager.connect(roomCode);

      setState(prev => ({
        ...prev,
        config: { roomCode },
      }));

      // Save to AsyncStorage
      if (saveConfig) {
        await AsyncStorage.setItem(STORAGE_KEYS.ROOM_CODE, roomCode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
      setState(prev => ({
        ...prev,
        status: prev.isRetrying ? 'remote_retrying' : 'remote_error',
        lastError: errorMessage,
      }));
      // Don't throw error if retry is enabled, as it will retry automatically
      if (!state.isRetrying) {
        throw error;
      }
    }
  }, [connectionManager, state.isRetrying]);

  /**
   * Disconnect from desktop
   */
  const disconnect = useCallback(async () => {
    try {
      await connectionManager.disconnect();

      setState(prev => ({
        ...prev,
        status: 'local_ready',
        isConnected: false,
        connectedAt: null,
        lastError: null,
        retryCount: 0,
        nextRetryIn: null,
        isRetrying: false,
      }));
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [connectionManager]);

  /**
   * Send message to desktop
   */
  const sendMessage = useCallback(async function* (
    messages: Array<{ role: string; content: string }>,
    searchMode: boolean,
    thinkingMode: boolean
  ): AsyncGenerator<string, void, unknown> {
    if (!state.isConnected) {
      throw new Error('Not connected to desktop');
    }

    try {
      yield* connectionManager.sendMessage(messages, searchMode, thinkingMode);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      setState(prev => ({
        ...prev,
        lastError: errorMessage,
      }));
      throw error;
    }
  }, [connectionManager, state.isConnected]);

  /**
   * Set connection mode (local or dynamic)
   */
  const setMode = useCallback(async (mode: ConnectionMode) => {
    try {
      setState(prev => ({
        ...prev,
        mode,
      }));

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.MODE, mode);

      // If switching to dynamic mode and we have a saved room code, try to connect
      if (mode === 'dynamic' && state.config?.roomCode && !state.isConnected) {
        await connect(state.config.roomCode, false);
      }

      // If switching to local mode, disconnect and disable retry
      if (mode === 'local') {
        connectionManager.disableRetry();
        if (state.isConnected || state.isRetrying) {
          await disconnect();
        }
      }
    } catch (error) {
      console.error('Failed to set mode:', error);
      throw error;
    }
  }, [state.config, state.isConnected, state.isRetrying, connect, disconnect, connectionManager]);

  /**
   * Update local model status (loading or ready)
   */
  const updateLocalModelStatus = useCallback((isLoading: boolean) => {
    setState(prev => {
      // Only update if we're in local mode
      if (prev.isConnected) {
        return prev; // Don't change status if connected to remote
      }

      return {
        ...prev,
        status: isLoading ? 'local_loading' : 'local_ready',
      };
    });
  }, []);

  const contextValue: RemoteConnectionContextType = {
    state,
    connect,
    disconnect,
    sendMessage,
    setMode,
    updateLocalModelStatus,
  };

  return (
    <RemoteConnectionContext.Provider value={contextValue}>
      {children}
    </RemoteConnectionContext.Provider>
  );
}

/**
 * Hook to access remote connection context
 */
export function useRemoteConnection(): RemoteConnectionContextType {
  const context = useContext(RemoteConnectionContext);
  if (!context) {
    throw new Error('useRemoteConnection must be used within RemoteConnectionProvider');
  }
  return context;
}
