import { LlamaContext, initLlama, releaseAllLlama } from 'llama.rn';
import * as DatabaseHelper from '../db/DatabaseHelper';

const EMBEDDING_DIMENSIONS = 384; // BGE small model dimension

interface ContextSettings {
  enabled: boolean;
}

interface ContextRow {
  id: string;
  text: string;
  distance?: number;
}

interface ReferenceRow {
  id: string;
  text: string;
}

class ContextManager {
  private static instance: ContextManager | null = null;
  private model: LlamaContext | null = null;
  private settings: ContextSettings = {
    enabled: true
  };
  private isInitialized: boolean = false;

  private constructor() {}

  public static getInstance(): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager();
    }
    return ContextManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await DatabaseHelper.initDatabase();
      await this.loadModel();
      await this.initializeReferenceEmbeddings();
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing context manager:', error);
      throw error;
    }
  }

  private async loadModel(): Promise<void> {
    try {
      // Initialize Llama model
      this.model = await initLlama({
        model: 'file://bge-small-en-v1.5-q4_k_m.gguf', // embedding-specific model
        is_model_asset: true,
        n_ctx: 512,  // smaller context for embeddings
        n_gpu_layers: 0, // CPU only for embeddings
        embedding: true // enable embedding mode
      });
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }

  public async unloadModel(): Promise<void> {
    this.model = null;
    this.isInitialized = false;
    await releaseAllLlama();
  }

  public isModelInitialized(): boolean {
    return this.isInitialized;
  }

  private async initializeReferenceEmbeddings(): Promise<void> {
    if (!this.model) throw new Error('Model not initialized');

    const hasExistingStatements = await DatabaseHelper.hasReferenceStatements();
    if (!hasExistingStatements) {
      // Initialize with default reference statements
      const referenceStatements = [
        "I am feeling",
        "I have been",
        "I want to share",
        "In my opinion",
        "I think that",
        "I believe",
        "I feel like",
        "I would like to"
      ];

      for (const text of referenceStatements) {
        const id = Math.random().toString(36).substring(7);
        const embedding = await this.getEmbedding(text);
        await DatabaseHelper.addReferenceStatement(id, text, embedding);
      }
    } else {
      // Update embeddings for existing statements
      const results = await DatabaseHelper.getReferenceStatements();
      const referenceStatements = results.map(row => ({
        id: String(row.id),
        text: String(row.text)
      }));
      
      for (const stmt of referenceStatements) {
        if (stmt.id && stmt.text) {
          const embedding = await this.getEmbedding(stmt.text);
          await DatabaseHelper.updateReferenceEmbedding(stmt.id, embedding);
        }
      }
    }
  }

  private async getEmbedding(text: string): Promise<Float32Array> {
    if (!this.model) throw new Error('Model not initialized');
    const result = await this.model.embedding(text);
    return new Float32Array(result.embedding);
  }

  private async isSelfReferential(text: string): Promise<boolean> {
    if (!this.model) throw new Error('Model not initialized');
    console.log('Checking if text is self-referential:', text);
    const inputEmbedding = await this.getEmbedding(text);
    const results = await DatabaseHelper.findSimilarReferenceEmbeddings(inputEmbedding, 1);
    // print results as string
    console.log('Results:', JSON.stringify(results));
    const DISTANCE_THRESHOLD = 0.9; // Lower distance means higher similarity
    return results.length > 0 && 
           typeof results[0].distance === 'number' && 
           results[0].distance > DISTANCE_THRESHOLD;
  }

  public async addContext(text: string, skipSelfReferentialCheck: boolean = false): Promise<boolean> {
    if (!this.settings.enabled) return false;
    if (!this.model) throw new Error('Model not initialized');

    if (!skipSelfReferentialCheck && !(await this.isSelfReferential(text))) return false;

    try {
      const embedding = await this.getEmbedding(text);
      const id = Math.random().toString(36).substring(7);
      return await DatabaseHelper.addContextEmbedding(id, text, embedding);
    } catch (error) {
      console.error('Error adding context:', error);
      return false;
    }
  }

  public async findSimilarContext(query: string, limit: number = 3): Promise<ContextRow[]> {
    if (!this.settings.enabled) return [];
    if (!this.model) throw new Error('Model not initialized');

    try {
      const queryEmbedding = await this.getEmbedding(query);
      const results = await DatabaseHelper.findSimilarContexts(queryEmbedding, limit);
      
      // Filter out contexts that are not relevant enough
      // Lower distance means higher similarity in cosine distance
      const RELEVANCE_THRESHOLD = 0.85;
      return results.filter(context => 
        typeof context.distance === 'number' && 
        context.distance <= RELEVANCE_THRESHOLD
      );
    } catch (error) {
      console.error('Error finding similar context:', error);
      return [];
    }
  }

  public async getAllContexts(): Promise<ContextRow[]> {
    return DatabaseHelper.getAllContexts();
  }

  public async removeContext(id: string) {
    return DatabaseHelper.removeContext(id);
  }

  public updateSettings(newSettings: Partial<ContextSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  public getSettings(): ContextSettings {
    return { ...this.settings };
  }

  public async clearAllContext() {
    return DatabaseHelper.clearAllContext();
  }
}

export default ContextManager; 