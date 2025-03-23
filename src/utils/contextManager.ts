import { open } from '@op-engineering/op-sqlite';
import { LlamaContext } from 'llama.rn';

const EMBEDDING_DIMENSIONS = 384; // BGE small model dimension

interface ContextSettings {
  enabled: boolean;
}

interface ContextRow {
  id: string;
  text: string;
  distance?: number;
}

class ContextManager {
  private db: ReturnType<typeof open>;
  private model: LlamaContext;
  private settings: ContextSettings = {
    enabled: true
  };

  constructor(db: ReturnType<typeof open>, model: LlamaContext) {
    this.db = db;
    this.model = model;
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    console.log('Initializing context database...');
    try {
      // Create context embeddings virtual table using vec0
      await this.db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS context_embeddings USING vec0(
          id TEXT PRIMARY KEY,
          text TEXT,
          embedding FLOAT[${EMBEDDING_DIMENSIONS}]
        );
      `);

      // Create reference embeddings virtual table
      await this.db.execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS reference_embeddings USING vec0(
          id TEXT PRIMARY KEY,
          text TEXT,
          embedding FLOAT[${EMBEDDING_DIMENSIONS}]
        );
      `);

      // Add reference statements if table is empty
      const count = await this.db.execute('SELECT COUNT(*) as count FROM reference_embeddings');
      if (count.rows[0].count === 0) {
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

        for (const stmt of referenceStatements) {
          const embedding = await this.getEmbedding(stmt);
          const id = Math.random().toString(36).substring(7);
          await this.db.execute(
            'INSERT INTO reference_embeddings (id, text, embedding) VALUES (?, ?, ?)',
            [id, stmt, JSON.stringify(Array.from(embedding))]
          );
        }
      }
      console.log('Context database initialized successfully');
    } catch (error) {
      console.error('Error initializing context database:', error);
      throw error;
    }
  }

  private async getEmbedding(text: string): Promise<Float32Array> {
    const result = await this.model.embedding(text);
    return new Float32Array(result.embedding);
  }

  private async isSelfReferential(text: string): Promise<boolean> {
    const inputEmbedding = await this.getEmbedding(text);
    
    // Use vec0's built-in similarity search
    const results = await this.db.execute(
      `SELECT text, distance
       FROM reference_embeddings
       WHERE embedding MATCH ?
       AND k = 1`,
      [JSON.stringify(Array.from(inputEmbedding))]
    );

    // print results
    console.log("results: " + JSON.stringify(results.rows));

    const DISTANCE_THRESHOLD = 0.9; // Lower distance means higher similarity
    return results.rows.length > 0 && 
           typeof results.rows[0].distance === 'number' && 
           results.rows[0].distance > DISTANCE_THRESHOLD;
  }

  public async addContext(text: string): Promise<boolean> {
    if (!this.settings.enabled) return false;

    if (!(await this.isSelfReferential(text))) return false;

    try {
      const embedding = await this.getEmbedding(text);
      const id = Math.random().toString(36).substring(7);
      
      await this.db.execute(
        'INSERT INTO context_embeddings (id, text, embedding) VALUES (?, ?, ?)',
        [id, text, JSON.stringify(Array.from(embedding))]
      );

      return true;
    } catch (error) {
      console.error('Error adding context:', error);
      return false;
    }
  }

  public async findSimilarContext(query: string, limit: number = 3): Promise<ContextRow[]> {
    if (!this.settings.enabled) return [];

    try {
      const queryEmbedding = await this.getEmbedding(query);
      
      const results = await this.db.execute(
        `SELECT id, text, distance
         FROM context_embeddings
         WHERE embedding MATCH ?
         AND k = ?`,
        [JSON.stringify(Array.from(queryEmbedding)), limit]
      );

      return results.rows.map((row: Record<string, any>) => ({
        id: row.id,
        text: row.text,
        distance: row.distance
      }));
    } catch (error) {
      console.error('Error finding similar context:', error);
      return [];
    }
  }

  public async getAllContexts(): Promise<ContextRow[]> {
    try {
      const results = await this.db.execute(
        `SELECT id, text 
         FROM context_embeddings 
         ORDER BY id DESC`
      );

      return results.rows.map((row: Record<string, any>) => ({
        id: row.id,
        text: row.text
      }));
    } catch (error) {
      console.error('Error getting all contexts:', error);
      return [];
    }
  }

  public async removeContext(id: string) {
    try {
      await this.db.execute('DELETE FROM context_embeddings WHERE id = ?', [id]);
    } catch (error) {
      console.error('Error removing context:', error);
      throw error;
    }
  }

  public updateSettings(newSettings: Partial<ContextSettings>) {
    this.settings = { ...this.settings, ...newSettings };
  }

  public getSettings(): ContextSettings {
    return { ...this.settings };
  }

  public async clearAllContext() {
    try {
      await this.db.execute('DELETE FROM context_embeddings;');
    } catch (error) {
      console.error('Error clearing all context:', error);
      throw error;
    }
  }
}

export default ContextManager; 