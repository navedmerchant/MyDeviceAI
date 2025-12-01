import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import RNFS from 'react-native-fs';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../App';
import { LlamaContext, initLlama, releaseAllLlama } from 'llama.rn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initDatabase,
  addContextEmbedding,
  getAllContexts,
  removeContext,
  clearAllContext,
  addReferenceStatement,
  hasReferenceStatements,
  getReferenceStatements,
  updateReferenceEmbedding,
  findSimilarReferenceEmbeddings
} from '../db/DatabaseHelper';

type ContextSettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'ContextSettings'>;

type Props = {
  navigation: ContextSettingsScreenNavigationProp;
};

interface ContextSettings {
  enabled: boolean;
}

const ContextSettings: React.FC<Props> = ({ navigation }) => {
  const embeddingContextRef = useRef<LlamaContext | undefined>(undefined);
  const [settings, setSettings] = useState<ContextSettings>({ enabled: true });
  const [newMemory, setNewMemory] = useState('');
  const [savedContexts, setSavedContexts] = useState<Array<{id: string; text: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  useEffect(() => {
    const initializeContext = async () => {
      try {
        await initDatabase();
        await loadContextSettings();
        await loadEmbeddingModel();
        await initializeReferenceEmbeddings();
        await loadSavedContexts();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize context');
      }
    };

    initializeContext();

    return () => {
      unloadEmbeddingModel();
    };
  }, []);

  const loadContextSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('contextSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('Error loading context settings:', error);
    }
  };

  const saveContextSettings = async (newSettings: ContextSettings) => {
    try {
      await AsyncStorage.setItem('contextSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving context settings:', error);
    }
  };

  const loadEmbeddingModel = async () => {
    try {
      let modelPath = 'file://bge-small-en-v1.5-q4_k_m.gguf';
      let isAsset = true;

      // On Android, check if model is downloaded to document directory
      if (Platform.OS === 'android') {
        const androidModelPath = `${RNFS.DocumentDirectoryPath}/model/bge-small-en-v1.5-q4_k_m.gguf`;
        const exists = await RNFS.exists(androidModelPath);
        if (exists) {
          modelPath = androidModelPath;
          isAsset = false;
          console.log('Using downloaded embedding model on Android');
        } else {
          console.log('Embedding model not found, skipping initialization');
          setError('Embedding model not downloaded. Please download models first.');
          return;
        }
      }

      embeddingContextRef.current = await initLlama({
        model: modelPath,
        is_model_asset: isAsset,
        n_ctx: 512,
        n_gpu_layers: 0,
        embedding: true
      });
      setIsModelLoaded(true);
    } catch (error) {
      console.error('Error loading embedding model:', error);
      setError('Failed to load embedding model');
    }
  };

  const unloadEmbeddingModel = async () => {
    embeddingContextRef.current = undefined;
    setIsModelLoaded(false);
    await releaseAllLlama();
  };

  const initializeReferenceEmbeddings = async () => {
    if (!embeddingContextRef.current) return;

    const hasExisting = await hasReferenceStatements();
    if (!hasExisting) {
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
        const embedding = await getEmbedding(text);
        if (embedding) {
          await addReferenceStatement(id, text, embedding);
        }
      }
    } else {
      const results = await getReferenceStatements();
      const referenceStatements = results.map(row => ({
        id: String(row.id),
        text: String(row.text)
      }));
      
      for (const stmt of referenceStatements) {
        if (stmt.id && stmt.text) {
          const embedding = await getEmbedding(stmt.text);
          if (embedding) {
            await updateReferenceEmbedding(stmt.id, embedding);
          }
        }
      }
    }
  };

  const getEmbedding = async (text: string): Promise<Float32Array | null> => {
    if (!embeddingContextRef.current) return null;
    try {
      const result = await embeddingContextRef.current.embedding(text);
      return new Float32Array(result.embedding);
    } catch (error) {
      console.error('Error getting embedding:', error);
      return null;
    }
  };

  const isSelfReferential = async (text: string): Promise<boolean> => {
    if (!embeddingContextRef.current) return false;
    
    const inputEmbedding = await getEmbedding(text);
    if (!inputEmbedding) return false;

    const results = await findSimilarReferenceEmbeddings(inputEmbedding, 1);
    const DISTANCE_THRESHOLD = 0.9;
    return results.length > 0 && 
           typeof results[0].distance === 'number' && 
           results[0].distance > DISTANCE_THRESHOLD;
  };

  const loadSavedContexts = async () => {
    setIsLoading(true);
    try {
      const contexts = await getAllContexts();
      setSavedContexts(contexts);
    } catch (err) {
      console.error('Error loading contexts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isModelLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading context model...</Text>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  const handleToggleEnabled = () => {
    const newSettings = {
      ...settings,
      enabled: !settings.enabled,
    };
    saveContextSettings(newSettings);
  };

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return;
    
    try {
      if (!settings.enabled || !embeddingContextRef.current) {
        Alert.alert('Error', 'Context system is not enabled or not ready');
        return;
      }

      // Skip self-referential check for manually added memories
      const embedding = await getEmbedding(newMemory.trim());
      if (!embedding) {
        Alert.alert('Error', 'Failed to process memory');
        return;
      }

      const id = Math.random().toString(36).substring(7);
      const success = await addContextEmbedding(id, newMemory.trim(), embedding);
      
      if (success) {
        setNewMemory('');
        loadSavedContexts(); // Refresh the list
      } else {
        Alert.alert('Error', 'Failed to add memory');
      }
    } catch (err) {
      console.error('Error adding memory:', err);
      Alert.alert('Error', 'Failed to add memory');
    }
  };

  const handleRemoveContext = async (id: string) => {
    try {
      await removeContext(id);
      loadSavedContexts(); // Refresh the list
    } catch (err) {
      console.error('Error removing context:', err);
      Alert.alert('Error', 'Failed to remove memory');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color="#fff" size={24} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory Settings</Text>
          
          <View style={styles.row}>
            <Text style={styles.label}>Enable Memory</Text>
            <Switch 
              value={settings?.enabled ?? false} 
              onValueChange={handleToggleEnabled} 
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Memory</Text>
          <Text style={styles.description}>
          Add things about you that you want the AI to remember.
               AI will recall these memories when you talk to it, 
               and when it is relevant to the conversation.          </Text>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.memoryInput]}
              value={newMemory}
              onChangeText={setNewMemory}
              placeholderTextColor="#666"
              multiline
            />
          </View>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={handleAddMemory}
          >
            <Text style={styles.buttonText}>Save Memory</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Memories</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <View style={styles.memoriesList}>
              {savedContexts.map((context) => (
                <View key={context.id} style={styles.memoryItem}>
                  <View style={styles.memoryContent}>
                    <Text style={styles.memoryText}>{context.text}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveContext(context.id)}
                  >
                    <Trash2 color="#FF3B30" size={20} />
                  </TouchableOpacity>
                </View>
              ))}
              {savedContexts.length === 0 && (
                <Text style={styles.noMemoriesText}>No saved memories yet</Text>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={() => {
            Alert.alert(
              'Clear All Memories',
              'Are you sure you want to clear all saved memories? This cannot be undone.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Clear All',
                  style: 'destructive',
                  onPress: async () => {
                    await clearAllContext();
                    loadSavedContexts();
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.clearButtonText}>Clear All Memories</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#FF3B30',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginTop: Platform.OS === 'ios' ? 50 : 0,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 5,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    padding: 12,
    color: '#fff',
  },
  memoryInput: {
    flex: 1,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  memoriesList: {
    marginTop: 8,
  },
  memoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    padding: 12,
    marginBottom: 8,
  },
  memoryContent: {
    flex: 1,
  },
  memoryText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
  },
  deleteButton: {
    padding: 8,
  },
  noMemoriesText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ContextSettings; 