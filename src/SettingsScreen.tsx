import React, { useState } from 'react';
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
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../App';

type SettingsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Settings'>;

type Props = {
  navigation: SettingsScreenNavigationProp;
};

const DEFAULT_SYSTEM_PROMPT = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a helpful AI assistant.
<|eot_id|>`;

// Helper function to strip meta tags from the prompt
const stripMetaTags = (prompt: string): string => {
  return prompt
    .replace('<|begin_of_text|><|start_header_id|>system<|end_header_id|>', '')
    .replace('<|eot_id|>', '')
    .trim();
};

// Helper function to add meta tags to the prompt
const addMetaTags = (prompt: string): string => {
  return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${prompt.trim()}\n<|eot_id|>`;
};

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [historyDays, setHistoryDays] = useState('30');
  const [braveApiKey, setBraveApiKey] = useState('');
  const [monthlyQueries, setMonthlyQueries] = useState('0');

  // Load settings when component mounts
  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedPrompt = await AsyncStorage.getItem('systemPrompt');
      const savedDays = await AsyncStorage.getItem('historyDays');
      const savedApiKey = await AsyncStorage.getItem('braveApiKey');
      const savedQueries = await AsyncStorage.getItem('monthlyQueries');
      
      if (savedPrompt) {
        setSystemPrompt(stripMetaTags(savedPrompt));
      } else {
        setSystemPrompt(stripMetaTags(DEFAULT_SYSTEM_PROMPT));
      }
      if (savedDays) setHistoryDays(savedDays);
      if (savedApiKey) setBraveApiKey(savedApiKey);
      if (savedQueries) setMonthlyQueries(savedQueries);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    try {
      const formattedPrompt = addMetaTags(systemPrompt);
      await AsyncStorage.setItem('systemPrompt', formattedPrompt);
      await AsyncStorage.setItem('historyDays', historyDays);
      await AsyncStorage.setItem('braveApiKey', braveApiKey);
      await AsyncStorage.setItem('monthlyQueries', monthlyQueries);
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
        <Text style={styles.title}>Settings</Text>
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
          <Text style={styles.description}>
            Monthly queries used: {monthlyQueries}/2000
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutContent}>
            <Text style={styles.aboutTitle}>MyDeviceAI</Text>
            <Text style={styles.versionText}>Version 1.0.0</Text>
            <Text style={styles.aboutDescription}>
              Built with Llama 3.2
            </Text>

            <View style={styles.licenseSection}>
              <Text style={styles.licenseSectionTitle}>Open Source Licenses</Text>
              
              <View style={styles.licenseItem}>
                <Text style={styles.licenseTitle}>Llama 3.2 Model</Text>
                <Text style={styles.licenseText}>
                  Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.
                </Text>
                <TouchableOpacity 
                  onPress={() => Linking.openURL('https://raw.githubusercontent.com/meta-llama/llama-models/refs/heads/main/models/llama3_2/LICENSE')}
                >
                  <Text style={styles.linkText}>View License</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.licenseItem}>
                <Text style={styles.licenseTitle}>Additional Libraries</Text>
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
                © 2025 Naved Merchant. All rights reserved.
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
});

export default SettingsScreen; 