/**
 * Cross-platform storage for P2PCF
 * Works on both React Native (AsyncStorage) and Web (localStorage)
 */

// Platform detection
const isReactNative =
  typeof navigator !== 'undefined' &&
  (navigator as any)?.product === 'ReactNative';

// Dynamic import for AsyncStorage (React Native only)
let AsyncStorage: any = null;
if (isReactNative) {
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    console.warn('[P2PCF Storage] AsyncStorage not available:', e);
  }
}

/**
 * Storage interface for P2PCF context persistence
 */
export class P2PCFStorage {
  private static readonly CONTEXT_ID_KEY = 'p2pcf_context_id';

  /**
   * Get stored context ID or null if not found
   */
  static async getContextId(): Promise<string | null> {
    try {
      if (isReactNative && AsyncStorage) {
        // React Native: use AsyncStorage
        return await AsyncStorage.getItem(this.CONTEXT_ID_KEY);
      } else if (typeof localStorage !== 'undefined') {
        // Web: use localStorage
        return localStorage.getItem(this.CONTEXT_ID_KEY);
      }
      return null;
    } catch (error) {
      console.error('[P2PCF Storage] Error getting context ID:', error);
      return null;
    }
  }

  /**
   * Save context ID to storage
   */
  static async setContextId(contextId: string): Promise<void> {
    try {
      if (isReactNative && AsyncStorage) {
        // React Native: use AsyncStorage
        await AsyncStorage.setItem(this.CONTEXT_ID_KEY, contextId);
      } else if (typeof localStorage !== 'undefined') {
        // Web: use localStorage
        localStorage.setItem(this.CONTEXT_ID_KEY, contextId);
      }
      console.log(`[P2PCF Storage] Saved context ID: ${contextId}`);
    } catch (error) {
      console.error('[P2PCF Storage] Error saving context ID:', error);
    }
  }

  /**
   * Clear stored context ID
   */
  static async clearContextId(): Promise<void> {
    try {
      if (isReactNative && AsyncStorage) {
        // React Native: use AsyncStorage
        await AsyncStorage.removeItem(this.CONTEXT_ID_KEY);
      } else if (typeof localStorage !== 'undefined') {
        // Web: use localStorage
        localStorage.removeItem(this.CONTEXT_ID_KEY);
      }
      console.log('[P2PCF Storage] Cleared context ID');
    } catch (error) {
      console.error('[P2PCF Storage] Error clearing context ID:', error);
    }
  }
}
