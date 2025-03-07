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
    
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error', error);
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
    const result = await db!.execute(
      'SELECT * FROM chat_histories ORDER BY timestamp DESC'
    );
    
    const histories: ChatHistory[] = [];
    for (const row of result.rows) {
      histories.push({
        id: Number(row.id),
        title: String(row.title),
        lastMessage: String(row.last_message),
        timestamp: Number(row.timestamp)
      });
    }
    
    return histories;
  } catch (error) {
    console.error('Error getting chat histories', error);
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