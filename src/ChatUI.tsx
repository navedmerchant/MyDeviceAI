import { LlamaContext, initLlama, releaseAllLlama } from 'llama.rn';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Markdown from 'react-native-markdown-display';
import Toast from 'react-native-simple-toast';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger
} from 'react-native-popup-menu';

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
import { ChevronLeft, Info, Send, Square, Trash2 } from 'lucide-react-native';
import { getModelParamsForDevice } from './Utils';
import { styles, markdownStyles, popoverStyles, menuOptionStyles } from './Syles';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean>();

  const chatContext = useRef('');
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let keyboardDidShowListener: EmitterSubscription;
    let keyboardDidHideListener: EmitterSubscription;

    async function checkFirstLaunch() {
      try {
        const hasLaunched = await AsyncStorage.getItem('hasLaunched');
        console.log(`isLaunched: ${hasLaunched}`);
        if (hasLaunched === null) {
          setIsFirstLaunch(true);
          await AsyncStorage.setItem('hasLaunched', 'true');
        } else {
          setIsFirstLaunch(false);
        }
      } catch (error) {
        console.error('Error checking first launch:', error);
      }
    }

    checkFirstLaunch();

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
      const modelParams = getModelParamsForDevice();
      
      console.log("model params:", modelParams)
      const newContext = await initLlama(modelParams);
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
    console.log(`current input length ${length}`);
    if (length > 2000) {
      Toast.show("Text too long, please try something shorter", Toast.SHORT);
      return;
    }
    if (inputText.trim()) {
      addMessage(inputText, true);
      setInputText('');
      setIsTyping(true);

      const firstPrompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
      You are a personal, empathetic AI assistant. Your aim is to be a friend to 
      the user and assist with questions. You need to be emotionally 
      available for them to talk about any personal topic they want to talk 
      about. Always be friendly, and be funny at times. You are also running locally
      so users dont complete privacy about their conversations. It never leaves their phone
      <|eot_id|><|start_header_id|>user<|end_header_id|> 
      ${inputText}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

      const otherPrompts = `<|start_header_id|>user<|end_header_id|> 
      ${inputText}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

      let prompt;
      if (messages.length == 0) {
        prompt = firstPrompt;
      } else {
        prompt = otherPrompts;
      }

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
            setCurrentResponse(prev => prev + data.token);
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

  const handleCopyText = (text: string) => {
    Clipboard.setString(text);
    Toast.show("Text copied to Clipboard", Toast.SHORT);
  };

  // ... (previous useEffect hooks and functions remain the same)

  const renderMessage = (message: Message) => (
    <Menu key={message.id}>
      <MenuTrigger
        triggerOnLongPress
        customStyles={{
          triggerTouchable: {
            underlayColor: 'transparent',
            activeOpacity: 0.6,
          },
        }}
      >
        <View
          style={[
            styles.messageBubble,
            message.isUser ? styles.userMessage : styles.aiMessage
          ]}
        >
          <Markdown style={markdownStyles}>{message.text}</Markdown>
        </View>
      </MenuTrigger>
      <MenuOptions customStyles={popoverStyles(message.isUser)}>
        <MenuOption onSelect={() => handleCopyText(message.text)} text="Copy" customStyles={menuOptionStyles}/>
      </MenuOptions>
    </Menu>
  );


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
        {messages.map(renderMessage)}
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
          placeholder={modelLoading? "Loading Model..." : "Ask me anything, or just chat!"}
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

export default ChatUI;
