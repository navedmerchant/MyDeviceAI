import { useEffect, useState } from 'react';
import { open } from '@op-engineering/op-sqlite';
import { initLlama, releaseAllLlama } from 'llama.rn';
import ContextManager from '../utils/contextManager';
import { AppState, AppStateStatus } from 'react-native';

export const useContextManager = () => {
  const [contextManager, setContextManager] = useState<ContextManager | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [db, setDb] = useState<ReturnType<typeof open> | null>(null);

  const loadModel = async () => {
    try {
      // Initialize Llama model
      const model = await initLlama({
        model: 'file://bge-small-en-v1.5-q4_k_m.gguf', // embedding-specific model
        is_model_asset: true,
        n_ctx: 512,  // smaller context for embeddings
        n_gpu_layers: 0, // CPU only for embeddings
        embedding: true // enable embedding mode
      });

      if (db) {
        // Create context manager instance
        const manager = new ContextManager(db, model);
        setContextManager(manager);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize model');
    }
  };

  const unloadModel = async () => {
    setContextManager(null);
    await releaseAllLlama();
  };

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        // Initialize SQLite database
        const database = open({
          name: 'user_context.db',
        });
        setDb(database);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize database');
      }
    };

    initializeDatabase();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('App has come to the foreground, loading model...');
        loadModel();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('App has gone to the background, unloading model...');
        unloadModel();
      }
    });

    return () => {
      subscription.remove();
      unloadModel();
    };
  }, [db]);

  return { contextManager, error };
};

export default useContextManager; 