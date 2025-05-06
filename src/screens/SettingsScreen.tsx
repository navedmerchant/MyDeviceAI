import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronRight, Cog, Settings, Download } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerNavigationProp } from '@react-navigation/drawer';
<<<<<<< HEAD:src/screens/SettingsScreen.tsx
import { DrawerParamList } from '../../App';
=======
import { DrawerParamList } from '../App';
import RNFS from 'react-native-fs';
import * as Progress from 'react-native-progress';
import { MODEL_NAMES, MODEL_URLS } from './constants/Models';

interface DownloadProgressData {
  bytesWritten: number;
  contentLength: number;
  jobId: number;
}
>>>>>>> baf273f (Android Support):src/SettingsScreen.tsx

type SettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Settings'>;

type Props = {
  navigation: SettingsScreenNavigationProp;
};

const DEFAULT_SYSTEM_PROMPT = `<|im_start|>system\n
You are a helpful personal AI assistant. Your name is Chloe, and you will be 
a professional AI assistant trying to answer all your users questions. You are locally
running on the device so you will never share any information outside of the chat.
Be as helpful as possible without being overly friendly. Be empathetic only when users
want to talk and share about personal feelings.<|im_end|>`;

const CONSTANT_PROMPT_INFO = `
You have access to the internet and can use it to search for information, if it is enabled by the user.
When provided with search results, use them to enhance your responses with current and accurate information.
The search results will be clearly marked with "Search Results:" in the user's messages.
Use these results to provide up-to-date information while maintaining your helpful and professional demeanor.`;

// Helper function to strip meta tags from the prompt
const stripMetaTags = (prompt: string): string => {
  return prompt
    .replace('<|im_start|>system\n', '')
    .replace('<|im_end|>', '')
    .trim();
};

// Helper function to add meta tags to the prompt
const addMetaTags = (prompt: string): string => {
  return `<|im_start|>system\n${prompt.trim()}\n<|im_end|>`;
};

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [historyDays, setHistoryDays] = useState('30');
<<<<<<< HEAD:src/screens/SettingsScreen.tsx
  // const [braveApiKey, setBraveApiKey] = useState(''); // Commented out
  // const [monthlyQueries, setMonthlyQueries] = useState('0'); // Commented out
=======
  const [braveApiKey, setBraveApiKey] = useState('');
  const [monthlyQueries, setMonthlyQueries] = useState('0');
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0);
  const [embeddingDownloadProgress, setEmbeddingDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEmbeddingDownloading, setIsEmbeddingDownloading] = useState(false);
  const [modelStatus, setModelStatus] = useState<'default' | 'downloaded' | 'not_downloaded'>('not_downloaded');
  const [embeddingStatus, setEmbeddingStatus] = useState<'default' | 'downloaded' | 'not_downloaded'>('not_downloaded');

  const MODEL_DIR = Platform.select({
    ios: `${RNFS.DocumentDirectoryPath}/model`,
    android: `${RNFS.DocumentDirectoryPath}/model`,
  }) as string;
>>>>>>> baf273f (Android Support):src/SettingsScreen.tsx

  // Load settings when component mounts
  useEffect(() => {
    loadSettings();
    checkModelStatus();
    checkEmbeddingStatus();
  }, []);

  const checkModelStatus = async () => {
    if (Platform.OS === 'ios') {
      setModelStatus('default');
      return;
    }

    try {
      const modelPath = `${MODEL_DIR}/${MODEL_NAMES.QWEN_MODEL}`;
      const exists = await RNFS.exists(modelPath);
      setModelStatus(exists ? 'downloaded' : 'not_downloaded');
    } catch (error) {
      console.error('Error checking model status:', error);
      setModelStatus('not_downloaded');
    }
  };

  const checkEmbeddingStatus = async () => {
    if (Platform.OS === 'ios') {
      setEmbeddingStatus('default');
      return;
    }

    try {
      const embeddingPath = `${MODEL_DIR}/${MODEL_NAMES.BGE_EMBEDDING_MODEL}`;
      const exists = await RNFS.exists(embeddingPath);
      setEmbeddingStatus(exists ? 'downloaded' : 'not_downloaded');
    } catch (error) {
      console.error('Error checking embedding status:', error);
      setEmbeddingStatus('not_downloaded');
    }
  };

  const downloadModel = async () => {
    if (Platform.OS === 'ios') return;

    const modelUrl = MODEL_URLS.QWEN_MODEL;
    const modelPath = `${MODEL_DIR}/${MODEL_NAMES.QWEN_MODEL}`;
    
    try {
      setIsDownloading(true);
      setModelDownloadProgress(0);

      // Create model directory if it doesn't exist
      await RNFS.mkdir(MODEL_DIR);

      // Download the model
      const { promise, jobId } = RNFS.downloadFile({
        fromUrl: modelUrl,
        toFile: modelPath,
        progress: (data: DownloadProgressData) => {
          const progress = data.bytesWritten / data.contentLength;
          setModelDownloadProgress(progress);
        },
        background: true,
        progressDivider: 1
      });

      await promise;
      setModelStatus('downloaded');
    } catch (error) {
      console.error('Error downloading model:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadEmbedding = async () => {
    if (Platform.OS === 'ios') return;

    const embeddingUrl = MODEL_URLS.BGE_EMBEDDING_MODEL;
    const embeddingPath = `${MODEL_DIR}/${MODEL_NAMES.BGE_EMBEDDING_MODEL}`;
    
    try {
      setIsEmbeddingDownloading(true);
      setEmbeddingDownloadProgress(0);

      // Create model directory if it doesn't exist
      await RNFS.mkdir(MODEL_DIR);

      // Download the embedding model
      const { promise, jobId } = RNFS.downloadFile({
        fromUrl: embeddingUrl,
        toFile: embeddingPath,
        progress: (data: DownloadProgressData) => {
          const progress = data.bytesWritten / data.contentLength;
          setEmbeddingDownloadProgress(progress);
        },
        background: true,
        progressDivider: 1
      });

      await promise;
      setEmbeddingStatus('downloaded');
    } catch (error) {
      console.error('Error downloading embedding model:', error);
    } finally {
      setIsEmbeddingDownloading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const savedPrompt = await AsyncStorage.getItem('systemPrompt');
      const savedDays = await AsyncStorage.getItem('historyDays');
      // const savedApiKey = await AsyncStorage.getItem('braveApiKey'); // Commented out
      // const savedQueries = await AsyncStorage.getItem('monthlyQueries'); // Commented out
      
      if (savedPrompt) {
        setSystemPrompt(stripMetaTags(savedPrompt));
      } else {
        setSystemPrompt(stripMetaTags(DEFAULT_SYSTEM_PROMPT));
      }
      if (savedDays) setHistoryDays(savedDays);
      // if (savedApiKey) setBraveApiKey(savedApiKey); // Commented out
      // if (savedQueries) setMonthlyQueries(savedQueries); // Commented out
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const formattedPrompt = addMetaTags(systemPrompt);
      await AsyncStorage.setItem('systemPrompt', formattedPrompt);
      await AsyncStorage.setItem('historyDays', historyDays);
      // await AsyncStorage.setItem('braveApiKey', braveApiKey); // Commented out
      // await AsyncStorage.setItem('monthlyQueries', monthlyQueries); // Commented out
      navigation.goBack();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleResetPrompt = () => {
    setSystemPrompt(stripMetaTags(DEFAULT_SYSTEM_PROMPT));
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color="#fff" size={24} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Settings color="#fff" size={24} />
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Management</Text>
          <Text style={styles.description}>
            {Platform.OS === 'ios' 
              ? 'Using built-in models optimized for iOS'
              : 'Download and manage AI models for offline use'}
          </Text>
          
          {Platform.OS === 'android' && (
            <View style={styles.modelSection}>
              <Text style={styles.modelTypeTitle}>Main Language Model</Text>
              {modelStatus === 'not_downloaded' && !isDownloading && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={downloadModel}
                >
                  <Download color="#fff" size={20} />
                  <Text style={styles.downloadButtonText}>Download Model (1GB)</Text>
                </TouchableOpacity>
              )}

              {isDownloading && (
                <View style={styles.downloadProgress}>
                  <Progress.Bar 
                    progress={modelDownloadProgress} 
                    width={200} 
                    color="#007AFF"
                  />
                  <Text style={styles.downloadProgressText}>
                    {Math.round(modelDownloadProgress * 100)}% Downloaded
                  </Text>
                </View>
              )}

              {modelStatus === 'downloaded' && !isDownloading && (
                <View style={styles.modelInfo}>
                  <Text style={styles.modelInfoText}>Main model installed and ready to use</Text>
                </View>
              )}

              <View style={styles.modelDivider} />

              <Text style={styles.modelTypeTitle}>Embedding Model</Text>
              {embeddingStatus === 'not_downloaded' && !isEmbeddingDownloading && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={downloadEmbedding}
                >
                  <Download color="#fff" size={20} />
                  <Text style={styles.downloadButtonText}>Download Embedding Model (85MB)</Text>
                </TouchableOpacity>
              )}

              {isEmbeddingDownloading && (
                <View style={styles.downloadProgress}>
                  <Progress.Bar 
                    progress={embeddingDownloadProgress} 
                    width={200} 
                    color="#007AFF"
                  />
                  <Text style={styles.downloadProgressText}>
                    {Math.round(embeddingDownloadProgress * 100)}% Downloaded
                  </Text>
                </View>
              )}

              {embeddingStatus === 'downloaded' && !isEmbeddingDownloading && (
                <View style={styles.modelInfo}>
                  <Text style={styles.modelInfoText}>Embedding model installed and ready to use</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Prompt</Text>
          <Text style={styles.description}>
            This is the initial prompt that defines the AI assistant's behavior.
          </Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            multiline
            value={systemPrompt}
            onChangeText={setSystemPrompt}
            placeholder="Enter system prompt..."
            placeholderTextColor="#666"
          />
          <TouchableOpacity 
            style={styles.resetButton}
            onPress={handleResetPrompt}
          >
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat History</Text>
          <Text style={styles.description}>
            Number of days to keep chat history
          </Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={historyDays}
            onChangeText={setHistoryDays}
            placeholder="Number of days to keep chat history"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Context Memory</Text>
          <TouchableOpacity 
            style={styles.navigationButton}
            onPress={() => navigation.navigate('ContextSettings')}
          >
            <View style={styles.navigationButtonContent}>
              <Text style={styles.navigationButtonText}>Configure Context Memory</Text>
              <ChevronRight color="#fff" size={20} />
            </View>
          </TouchableOpacity>
          <Text style={styles.description}>
            Configure how the AI remembers and uses context from your conversations.
          </Text>
        </View>

        {/* <View style={styles.section}>
          <Text style={styles.sectionTitle}>Brave Search API</Text>
          <Text style={styles.description}>
            Enter your Brave Search API key to enable web search capabilities
          </Text>
          <TextInput
            style={styles.textInput}
            value={braveApiKey}
            onChangeText={setBraveApiKey}
            placeholder="Enter Brave Search API key"
            placeholderTextColor="#666"
            secureTextEntry={true}
          />
          {!braveApiKey && (
            <TouchableOpacity 
              style={styles.linkContainer}
              onPress={() => Linking.openURL('https://navedmerchant.github.io/brave_search.html')}
            >
              <Text style={styles.linkText}>Need an API key? Click here for setup instructions</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.description}>
            Monthly queries used: {monthlyQueries}/2000
          </Text>
        </View> */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutContent}>
            <Text style={styles.aboutTitle}>MyDeviceAI</Text>
            <Text style={styles.versionText}>Version 1.2.0</Text>

            <View style={styles.licenseSection}>
              <View style={styles.licenseItem}>
                <Text style={styles.licenseTitle}>Third Party Libraries</Text>
                <Text style={styles.licenseText}>
                  This application uses various open-source libraries, each with their respective licenses.
                  For a complete list of licenses, please visit the link below.
                </Text>
                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://github.com/navedmerchant/MyDeviceAILicenses/blob/main/README.md')}
                >
                  <Text style={styles.linkText}>View License</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.copyrightSection}>
              <Text style={styles.copyrightText}>
                Built by Naved Merchant
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity 
        style={styles.saveButton}
        onPress={saveSettings}
      >
        <Text style={styles.saveButtonText}>Save Changes</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    ...Platform.select({
      ios: {
        paddingTop: 50,
      }
    }),
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80, // Fixed width to balance the layout
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  placeholder: {
    width: 80, // Same width as backButton to maintain balance
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
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#999',
    fontSize: 14,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    minHeight: 40,
  },
  multilineInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  resetButton: {
    marginTop: 8,
    padding: 8,
    alignSelf: 'flex-start',
  },
  resetButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    margin: 16,
    marginBottom: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  aboutContent: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
  },
  aboutTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  versionText: {
    color: '#999',
    fontSize: 16,
    marginBottom: 10,
  },
  aboutDescription: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  licenseSection: {
    marginBottom: 24,
  },
  licenseSectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  licenseItem: {
    marginBottom: 12,
  },
  licenseTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  licenseText: {
    color: '#999',
    fontSize: 14,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
  copyrightSection: {
    marginTop: 24,
    alignItems: 'center',
  },
  copyrightText: {
    color: '#999',
    fontSize: 14,
  },
  navigationButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  navigationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  linkContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  modelSection: {
    marginTop: 12,
  },
  modelTypeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modelDivider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 16,
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  downloadProgress: {
    alignItems: 'center',
    gap: 8,
  },
  downloadProgressText: {
    color: '#fff',
    fontSize: 14,
  },
  modelInfo: {
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  modelInfoText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default SettingsScreen; 