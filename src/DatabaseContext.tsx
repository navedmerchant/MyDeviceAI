// context/DatabaseContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  initDatabase,
  getAllChatHistories,
  ChatHistory,
  deleteChatHistory,
} from './DatabaseHelper';

interface DatabaseContextType {
  globalHistoryId: number | null;
  histories: ChatHistory[];
  loadHistories: () => Promise<void>;
  deleteHistory: (historyId: number) => Promise<void>;
  setGlobalHistoryId: (historyId: number | null) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [histories, setHistories] = useState<ChatHistory[]>([]);
  const [globalHistoryId, setGlobalHistoryId] = useState<number | null>(null);

  useEffect(() => {
    initDatabase();
    loadHistories();
  }, []);

  const loadHistories = async () => {
    try {
      const allHistories = await getAllChatHistories();
      setHistories(allHistories);
    } catch (error) {
      console.error('Error loading histories:', error);
    }
  };

  const deleteHistory = async (historyId: number) => {
    try {
      await deleteChatHistory(historyId);
      await loadHistories();
    } catch (error) {
      console.error('Error deleting history:', error);
    }
  };

  return (
    <DatabaseContext.Provider value={{ histories, loadHistories, deleteHistory, globalHistoryId, setGlobalHistoryId }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};