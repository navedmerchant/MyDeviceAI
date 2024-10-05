import { LlamaContext, initLlama, releaseAllLlama } from 'llama.rn';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Markdown from 'react-native-markdown-display';
import Toast from 'react-native-simple-toast';

import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  EmitterSubscription,
  ActivityIndicator,
  TouchableWithoutFeedback,
  GestureResponderEvent,
  Clipboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AppState,
  StatusBar,
  Modal,
  Linking,
  Alert,
} from 'react-native';
import { ChevronLeft, Info, Send, Settings, Square, StopCircle, Trash2 } from 'lucide-react-native';

interface Message {
  id: number;
  text: string;
  isUser: boolean;
}

const ChatUI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [context, setContext] = useState<LlamaContext>();
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const chatContext = useRef('');
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let keyboardDidShowListener: EmitterSubscription;
    let keyboardDidHideListener: EmitterSubscription;

    if (Platform.OS === 'ios') {
      keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', scrollToBottom);
      keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', scrollToBottom);
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        loadModel()
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        console.log('App has gone to the background!');
        if (isTyping) {
          context?.stopCompletion();
        }
        setShowInfo(false);
        unloadModel()
      }

      appState.current = nextAppState;
    });

    return () => {
      if (Platform.OS === 'ios') {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (isAutoScrolling) {
      scrollToBottom();
    }
  }, [contentHeight])

  useEffect(() => {
      if (!modelLoading) {
        textInputRef.current?.focus();
      }
  }, [modelLoading])

  const loadModel = async () => {
    console.log("Loading model");
    console.log("Started load and predict");
    try {
      const newContext = await initLlama({
        model: 'file://Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        is_model_asset: true,
        use_mmap: true,
        n_ctx: 4096,
        n_gpu_layers: 48, // > 0: enable Metal on iOS
      });

      setContext(newContext);
      setModelLoading(false);
      console.log("model loaded successfully");
    } catch (error) {
      console.log("Error loading model" + error);
      Alert.alert("Failed to load model! please close the app and try again by closing some background apps");
    }
  }

  const unloadModel = async () => {
    console.log("Unloading model");
    setModelLoading(true);
    await releaseAllLlama();
    console.log("releaseed all LLama");
  }

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const addMessage = useCallback((text: string, isUser: boolean) => {
    setMessages(prevMessages => [
      ...prevMessages,
      { id: Date.now(), text, isUser }
    ]);
    setTimeout(scrollToBottom, 100);
  }, []);


  const handleSend = useCallback(async () => {
    const length = inputText.split(/\s+/).length;
    console.log(`length ${length}`);
    if (length > 2000) {
      Toast.show("Text too long, please try something shorter", Toast.SHORT);
      return;
    }
    if (inputText.trim()) {
      addMessage(inputText, true);
      setInputText('');
      setIsTyping(true);

      const prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
      You are a helpful assistant<|eot_id|><|start_header_id|>user<|end_header_id|> 
      ${inputText}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

      chatContext.current = chatContext.current + prompt;

      if (!context) {
        console.log("context is undefined!")
        return;
      }

      try {
        // Do completion
        const { text, timings } = await context.completion(
          {
            prompt: chatContext.current,
            n_predict: 1024,
            temperature: 0.7,
          },
          (data) => {
            if  (data.token == "<|eot_id|>") {
                return;
            }
            setCurrentResponse(prev => prev + (prev ? ' ' : '') + data.token);
          },
        )
        chatContext.current = chatContext.current + text;
        const displayText = text.replace("<|eot_id|>", "")
        addMessage(displayText, false);
      } catch (error) {
        console.error('Error generating AI response:', error);
        addMessage('Sorry, I encountered an error. Please try again.', false);
      } finally {
        setIsTyping(false);
        setCurrentResponse('');
      }
    }
  }, [inputText, addMessage]);

  function copyToClipboard(text: string): void {
    Clipboard.setString(text);
    Toast.show("Text copied to Clipboard", Toast.SHORT);
  }

  function handleStop(event: GestureResponderEvent): void {
    context?.stopCompletion();
    setIsTyping(false);
  }

  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize} : NativeScrollEvent) => {
    const paddingToBottom = 20;
    return layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  function handleScrollEvent(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const bottom = isCloseToBottom(event.nativeEvent);
    setIsAutoScrolling(bottom);
  }

  function handleContentSizeChange(w: number, h: number): void {
    setContentHeight(h);
  }

  function handleClear(event: GestureResponderEvent): void {
    setMessages([]);
    chatContext.current='';
  }

  function handleInfoPress(event: GestureResponderEvent): void {
    // do nothing for now, will be implemented later
    setShowInfo(true);
  }

  const InfoScreen = () => (
    <Modal
      animationType="slide"
      visible={showInfo}
      onRequestClose={() => setShowInfo(false)}
    >
      <View style={styles.infoContainer}>
        <View style={styles.infoHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => setShowInfo(false)}
          >
            <ChevronLeft color="#fff" size={24} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.infoTitle}>About</Text>
        </View>
        
        <ScrollView style={styles.infoContent}>
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>MyDeviceAI</Text>
            <Text style={styles.versionText}>Version 1.0.0</Text>
            <Text style={styles.infoDescription}>
              Built with Llama 3.2
            </Text>
          </View>
          
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
              © 2024 Naved Merchant. All rights reserved.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );


  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleInfoPress} disabled={isTyping}>
            <Info color="#fff" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MyDeviceAI</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleClear} disabled={isTyping}>
           <Trash2 color="#fff" size={24} />
        </TouchableOpacity>
      </View>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.scrollViewContent}
        onScroll={handleScrollEvent}
        onContentSizeChange={handleContentSizeChange}
        scrollEventThrottle={16} 
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.isUser ? styles.userMessage : styles.aiMessage
            ]}
          > 
            <TouchableWithoutFeedback onLongPress={() => copyToClipboard(message.text)}>
                <Markdown style={markdownStyles}>{message.text}</Markdown>
            </TouchableWithoutFeedback>
          </View>
        ))}
        {isTyping && (
          <View style={[styles.messageBubble, styles.aiMessage]}>
            <Text style={styles.aiMessageText}> {currentResponse}</Text>
          </View>
        )}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask MyDeviceAI Anything!"
          placeholderTextColor="#999"
          ref={textInputRef}
          multiline={true}
          editable={!modelLoading}
          numberOfLines={2}
        />
        {
        modelLoading ? 
        (<ActivityIndicator></ActivityIndicator>) :
        (isTyping ? 
        (<TouchableOpacity style={styles.stopButton} onPress={handleStop}>
          <Square color="#fff"></Square>
        </TouchableOpacity>) : 
        (<TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Send color="#fff"></Send>
        </TouchableOpacity>))
        }
      </View>
      <InfoScreen/>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#000',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerButton: {
    padding: 5,
    color: '#fff',
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 10,
    paddingBottom: 20,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 20,
    marginBottom: 10,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  aiMessage: {
    width: '80%',
    alignSelf: 'flex-start',
    backgroundColor: '#7d17b0',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#000',
    maxHeight: 80
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    color: '#fff',
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  stopButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#c20a10',
    borderRadius: 20,
    paddingHorizontal: 20,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  clearButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2b2727',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  infoContainer: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: '#000',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#000',
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
  infoTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 85,
  },
  infoContent: {
    flex: 1,
    padding: 15,
  },
  infoSection: {
    marginBottom: 30,
  },
  infoSectionTitle: {
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
  infoDescription: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  licenseSection: {
    marginBottom: 30,
  },
  licenseSectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  licenseItem: {
    marginBottom: 20,
  },
  licenseTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  licenseText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 5,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
    marginTop: 5,
  },
  copyrightSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  copyrightText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});

const markdownStyles = {
  text: {
    color: '#fff', // White text
  },
  heading1: {
    color: '#fff', // White heading
  },
  strong: {
    color: '#fff', // White bold text
  },
  em: {
    color: '#fff', // White italic text
  },
  link: {
    color: '#1E90FF', // Blue color for links
  },
  list_item: {
    color: '#fff', // White list items
  },
  code: {
    color: '#000' // code should be black
  },
  code_inline: {
    color: '#000'
  },
  blockquote: {
    color: '#000'
  }
}

export default ChatUI;