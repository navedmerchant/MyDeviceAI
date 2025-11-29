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
  Alert,
} from 'react-native';
import { ChevronLeft, ChevronRight, Cog, Settings } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../../App';
import { cleanupOldChatHistories } from '../db/DatabaseHelper';

type SettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Settings'>;

type Props = {
  navigation: SettingsScreenNavigationProp;
};

const DEFAULT_SYSTEM_PROMPT = `You are a helpful personal AI assistant. Your name is Chloe, and you will be 
a professional AI assistant trying to answer all your users questions. You are locally
running on the device so you will never share any information outside of the chat.
Be as helpful as possible without being overly friendly. Be empathetic only when users
want to talk and share about personal feelings.`;

const CONSTANT_PROMPT_INFO = `
You have access to the internet and can use it to search for information, if it is enabled by the user.
When provided with search results, use them to enhance your responses with current and accurate information.
The search results will be clearly marked with "Search Results:" in the user's messages.
Use these results to provide up-to-date information while maintaining your helpful and professional demeanor.`;

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [historyDays, setHistoryDays] = useState('30');
  // const [braveApiKey, setBraveApiKey] = useState(''); // Commented out
  // const [monthlyQueries, setMonthlyQueries] = useState('0'); // Commented out

  // Load settings when component mounts
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedPrompt = await AsyncStorage.getItem('systemPrompt');
      const savedDays = await AsyncStorage.getItem('historyDays');
      // const savedApiKey = await AsyncStorage.getItem('braveApiKey'); // Commented out
      // const savedQueries = await AsyncStorage.getItem('monthlyQueries'); // Commented out
      
      if (savedPrompt) {
        setSystemPrompt(savedPrompt);
      } else {
        setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
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
      // Validate history days input
      const historyDaysNum = parseInt(historyDays, 10);
      if (isNaN(historyDaysNum) || historyDaysNum < 1) {
        Alert.alert('Invalid Input', 'Please enter a valid number of days (minimum 1)');
        return;
      }
      
      await AsyncStorage.setItem('systemPrompt', systemPrompt);
      await AsyncStorage.setItem('historyDays', historyDays);
      // await AsyncStorage.setItem('braveApiKey', braveApiKey); // Commented out
      // await AsyncStorage.setItem('monthlyQueries', monthlyQueries); // Commented out
      
      // Trigger cleanup of old chat histories based on the new setting
      await cleanupOldChatHistories();
      
      navigation.goBack();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleResetPrompt = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
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
            Number of days to keep chat history (minimum 1 day)
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Settings</Text>
          <TouchableOpacity 
            style={styles.navigationButton}
            onPress={() => navigation.navigate('AdvancedSettings')}
          >
            <View style={styles.navigationButtonContent}>
              <Text style={styles.navigationButtonText}>Manage Models</Text>
              <ChevronRight color="#fff" size={20} />
            </View>
          </TouchableOpacity>
          <Text style={styles.description}>
            Search, download, and manage GGUF models from Hugging Face.
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
            <Text style={styles.versionText}>Version 1.7.0</Text>

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
    marginTop: 50,
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
});

export default SettingsScreen; 