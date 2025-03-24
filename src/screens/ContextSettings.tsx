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
} from 'react-native';
import { ChevronLeft, Trash2 } from 'lucide-react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../App';
import ContextManager from '../utils/ContextManager';

type ContextSettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'ContextSettings'>;

type Props = {
  navigation: ContextSettingsScreenNavigationProp;
};

const ContextSettings: React.FC<Props> = ({ navigation }) => {
  const contextManager = useRef(ContextManager.getInstance());
  const [settings, setSettings] = useState(contextManager.current.getSettings());
  const [newMemory, setNewMemory] = useState('');
  const [savedContexts, setSavedContexts] = useState<Array<{id: string; text: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeContextManager = async () => {
      try {
        if (!contextManager.current.isModelInitialized()) {
          await contextManager.current.initialize();
        }
        setSettings(contextManager.current.getSettings());
        await loadSavedContexts();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize context manager');
      }
    };

    initializeContextManager();
  }, []);

  const loadSavedContexts = async () => {
    if (!contextManager.current) return;
    setIsLoading(true);
    try {
      const contexts = await contextManager.current.getAllContexts();
      setSavedContexts(contexts);
    } catch (err) {
      console.error('Error loading contexts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!contextManager.current) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  const handleToggleEnabled = () => {
    if (!settings) return;
    const newSettings = {
      ...settings,
      enabled: !settings.enabled,
    };
    contextManager.current.updateSettings(newSettings);
    setSettings(newSettings);
  };

  const handleAddMemory = async () => {
    if (!newMemory.trim()) return;
    
    try {
      await contextManager.current.addContext(newMemory.trim(), true);
      setNewMemory('');
      loadSavedContexts(); // Refresh the list
    } catch (err) {
      console.error('Error adding memory:', err);
      Alert.alert('Error', 'Failed to add memory');
    }
  };

  const handleRemoveContext = async (id: string) => {
    try {
      await contextManager.current.removeContext(id);
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
        <Text style={styles.title}>Memory Settings</Text>
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
            Add text that you want the AI to remember for future conversations.
          </Text>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.memoryInput]}
              value={newMemory}
              onChangeText={setNewMemory}
              placeholder="Enter text to remember..."
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
                    await contextManager.current.clearAllContext();
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
    marginTop: 50,
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
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 85,
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