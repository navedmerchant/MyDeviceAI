// DatabaseHelper.ts
import { open, type DB } from '@op-engineering/op-sqlite';
import { Message } from './Message';

let db: DB | null = null;

export interface ChatHistory {
  id: number;
  title: string;
  lastMessage: string;
  timestamp: number;
}

const EMBEDDING_DIMENSIONS = 384; // BGE small model dimension

export const initDatabase = async () => {
  try {
    db = open({
      name: 'chathistory.db',
      location: 'default'
    });
    
    await db.execute(
      `CREATE TABLE IF NOT EXISTS chat_histories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        last_message TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );`
    );
    
    await db.execute(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        history_id INTEGER,
        message TEXT NOT NULL,
        is_user INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (history_id) REFERENCES chat_histories (id)
      );`
    );

    // Create context embeddings virtual table using vec0
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS context_embeddings USING vec0(
        id TEXT PRIMARY KEY,
        text TEXT,
        embedding FLOAT[${EMBEDDING_DIMENSIONS}]
      );
    `);

    // Create reference embeddings virtual table
    await db.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS reference_embeddings USING vec0(
        id TEXT PRIMARY KEY,
        text TEXT,
        embedding FLOAT[${EMBEDDING_DIMENSIONS}]
      );
    `);
    
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error', error);
  }
};

export const hasReferenceStatements = async (): Promise<boolean> => {
  if (!db) await initDatabase();
  
  try {
    const count = await db!.execute('SELECT COUNT(*) as count FROM reference_embeddings');
    return Number(count.rows[0].count) > 0;
  } catch (error) {
    console.error('Error checking reference statements:', error);
    return false;
  }
};

export const addReferenceStatement = async (id: string, text: string, embedding: Float32Array) => {
  if (!db) await initDatabase();
  
  try {
    await db!.execute(
      'INSERT INTO reference_embeddings (id, text, embedding) VALUES (?, ?, ?)',
      [id, text, JSON.stringify(Array.from(embedding))]
    );
    return true;
  } catch (error) {
    console.error('Error adding reference statement:', error);
    return false;
  }
};

export const saveNewChatHistory = async (title: string, firstMessage: string): Promise<number> => {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const result = await db!.execute(
      'INSERT INTO chat_histories (title, last_message, timestamp) VALUES (?, ?, ?)',
      [title, firstMessage, Date.now()]
    );
    
    return result.insertId ?? 0;
  } catch (error) {
    console.error('Error saving chat history', error);
    throw error;
  }
};

export const saveChatMessage = async (historyId: number, message: string, isUser: boolean) => {
  if (!db) {
    await initDatabase();
  }
  
  try {
    await db!.execute(
      'INSERT INTO chat_messages (history_id, message, is_user, timestamp) VALUES (?, ?, ?, ?)',
      [historyId, message, isUser ? 1 : 0, Date.now()]
    );
    
    await db!.execute(
      'UPDATE chat_histories SET last_message = ?, timestamp = ? WHERE id = ?',
      [message, Date.now(), historyId]
    );
    
    return true;
  } catch (error) {
    console.error('Error saving chat message', error);
    throw error;
  }
};

export const loadChatHistory = async (historyId: number): Promise<Message[]> => {
  if (!db) {
    await initDatabase();
  }
  
  try {
    const result = await db!.execute(
      'SELECT * FROM chat_messages WHERE history_id = ? ORDER BY timestamp ASC',
      [historyId]
    );
    
    const messages: Message[] = [];
    for (const row of result.rows) {
      messages.push({
        id: Number(row.id),
        text: String(row.message),
        isUser: Boolean(row.is_user)
      });
    }
    
    return messages;
  } catch (error) {
    console.error('Error loading chat history', error);
    throw error;
  }
};

export const getAllChatHistories = async (): Promise<ChatHistory[]> => {
  if (!db) {
    await initDatabase();
  }
  
  try {
    // Add LIMIT to prevent loading too many histories at once
    // and only select necessary columns
    const result = await db!.execute(
      'SELECT id, title, last_message, timestamp FROM chat_histories ORDER BY timestamp DESC LIMIT 50'
    );
    
    // Pre-allocate array for better performance
    const histories: ChatHistory[] = new Array(result.rows.length);
    let i = 0;
    
    for (const row of result.rows) {
      histories[i++] = {
        id: Number(row.id),
        title: String(row.title),
        lastMessage: String(row.last_message),
        timestamp: Number(row.timestamp)
      };
    }
    
    return histories;
  } catch (error) {
    console.error('Error getting chat histories:', error);
    throw error;
  }
};

export const deleteChatHistory = async (historyId: number): Promise<void> => {
  if (!db) {
    await initDatabase();
  }
  
  try {
    await db!.execute(
      'DELETE FROM chat_messages WHERE history_id = ?',
      [historyId]
    );
    
    await db!.execute(
      'DELETE FROM chat_histories WHERE id = ?',
      [historyId]
    );
  } catch (error) {
    console.error('Error deleting chat history', error);
    throw error;
  }
};

export const deleteAllHistories = async (): Promise<void> => {
  if (!db) {
    await initDatabase();
  }
  
  try {
    // Delete all messages first due to foreign key constraint
    await db!.execute('DELETE FROM chat_messages');
    
    // Then delete all histories
    await db!.execute('DELETE FROM chat_histories');
  } catch (error) {
    console.error('Error deleting all chat histories:', error);
    throw error;
  }
};

// New context-related functions
export const addContextEmbedding = async (id: string, text: string, embedding: Float32Array) => {
  if (!db) await initDatabase();
  
  try {
    await db!.execute(
      'INSERT INTO context_embeddings (id, text, embedding) VALUES (?, ?, ?)',
      [id, text, JSON.stringify(Array.from(embedding))]
    );
    return true;
  } catch (error) {
    console.error('Error adding context embedding:', error);
    return false;
  }
};

export const findSimilarContexts = async (embedding: Float32Array, limit: number = 3) => {
  if (!db) await initDatabase();
  
  try {
    const results = await db!.execute(
      `SELECT id, text, distance
       FROM context_embeddings
       WHERE embedding MATCH ?
       AND k = ?`,
      [JSON.stringify(Array.from(embedding)), limit]
    );

    return results.rows.map((row: Record<string, any>) => ({
      id: row.id,
      text: row.text,
      distance: row.distance
    }));
  } catch (error) {
    console.error('Error finding similar contexts:', error);
    return [];
  }
};

export const getAllContexts = async () => {
  if (!db) await initDatabase();
  
  try {
    const results = await db!.execute(
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
};

export const removeContext = async (id: string) => {
  if (!db) await initDatabase();
  
  try {
    await db!.execute('DELETE FROM context_embeddings WHERE id = ?', [id]);
  } catch (error) {
    console.error('Error removing context:', error);
    throw error;
  }
};

export const clearAllContext = async () => {
  if (!db) await initDatabase();
  
  try {
    await db!.execute('DELETE FROM context_embeddings;');
  } catch (error) {
    console.error('Error clearing all context:', error);
    throw error;
  }
};

export const updateReferenceEmbedding = async (id: string, embedding: Float32Array) => {
  if (!db) await initDatabase();
  
  try {
    await db!.execute(
      'UPDATE reference_embeddings SET embedding = ? WHERE id = ?',
      [JSON.stringify(Array.from(embedding)), id]
    );
  } catch (error) {
    console.error('Error updating reference embedding:', error);
    throw error;
  }
};

export const getReferenceStatements = async () => {
  if (!db) await initDatabase();
  
  try {
    const results = await db!.execute('SELECT id, text FROM reference_embeddings');
    return results.rows;
  } catch (error) {
    console.error('Error getting reference statements:', error);
    return [];
  }
};

export const findSimilarReferenceEmbeddings = async (embedding: Float32Array, limit: number = 1) => {
  if (!db) await initDatabase();
  
  try {
    const results = await db!.execute(
      `SELECT id, text, distance
       FROM reference_embeddings
       WHERE embedding MATCH ?
       AND k = ?`,
      [JSON.stringify(Array.from(embedding)), limit]
    );

    return results.rows.map((row: Record<string, any>) => ({
      id: row.id,
      text: row.text,
      distance: row.distance
    }));
  } catch (error) {
    console.error('Error finding similar reference embeddings:', error);
    return [];
  }
};