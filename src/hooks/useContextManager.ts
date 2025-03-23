import { useEffect, useState } from 'react';
import { open } from '@op-engineering/op-sqlite';
import { initLlama } from 'llama.rn';
import ContextManager from '../utils/contextManager';

export const useContextManager = () => {
  const [contextManager, setContextManager] = useState<ContextManager | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeContextManager = async () => {
      try {
        // Initialize SQLite database
        const db = open({
          name: 'user_context.db',
        });

        // Initialize Llama model
        const model = await initLlama({
            model: 'file://bge-small-en-v1.5-q4_k_m.gguf', // embedding-specific model
            is_model_asset: true,
            n_ctx: 512,  // smaller context for embeddings
            n_gpu_layers: 0, // CPU only for embeddings
            embedding: true // enable embedding mode
        });

        // Create context manager instance
        const manager = new ContextManager(db, model);
        setContextManager(manager);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize context manager');
      }
    };

    initializeContextManager();
  }, []);

  return { contextManager, error };
};

export default useContextManager; 