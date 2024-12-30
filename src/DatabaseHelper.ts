// DatabaseHelper.ts
import SQLite from 'react-native-sqlite-storage';
import { Message } from './Message';

const db = SQLite.openDatabase(
  {
    name: 'chathistory.db',
    location: 'default'
  },
  () => console.log('Database connected'),
  error => console.error('Database error', error)
);

export interface ChatHistory {
  id: number;
  title: string;
  lastMessage: string;
  timestamp: number;
}

export const initDatabase = () => {
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS chat_histories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        last_message TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );`
    );
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        history_id INTEGER,
        message TEXT NOT NULL,
        is_user INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (history_id) REFERENCES chat_histories (id)
      );`
    );
  });
};

export const saveNewChatHistory = (title: string, firstMessage: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO chat_histories (title, last_message, timestamp) VALUES (?, ?, ?)',
        [title, firstMessage, Date.now()],
        (_, result) => resolve(result.insertId),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const saveChatMessage = (historyId: number, message: string, isUser: boolean) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'INSERT INTO chat_messages (history_id, message, is_user, timestamp) VALUES (?, ?, ?, ?)',
        [historyId, message, isUser ? 1 : 0, Date.now()],
        (_, result) => {
          tx.executeSql(
            'UPDATE chat_histories SET last_message = ?, timestamp = ? WHERE id = ?',
            [message, Date.now(), historyId]
          );
          resolve(result);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const loadChatHistory = (historyId: number): Promise<Message[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM chat_messages WHERE history_id = ? ORDER BY timestamp ASC',
        [historyId],
        (_, result) => {
          const messages: Message[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            messages.push({
              id: row.id,
              text: row.message,
              isUser: Boolean(row.is_user)
            });
          }
          resolve(messages);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const getAllChatHistories = (): Promise<ChatHistory[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM chat_histories ORDER BY timestamp DESC',
        [],
        (_, result) => {
          const histories: ChatHistory[] = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            histories.push({
              id: row.id,
              title: row.title,
              lastMessage: row.last_message,
              timestamp: row.timestamp
            });
          }
          resolve(histories);
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};

export const deleteChatHistory = (historyId: number): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM chat_messages WHERE history_id = ?',
        [historyId],
        (_, result) => {
          tx.executeSql(
            'DELETE FROM chat_histories WHERE id = ?',
            [historyId],
            (_, result) => resolve(),
            (_, error) => {
              reject(error);
              return false;
            }
          );
        },
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
};