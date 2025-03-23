import { LlamaContext, initLlama, releaseAllLlama } from 'llama.rn';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Markdown from 'react-native-markdown-display';
import Toast from 'react-native-simple-toast';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';

import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  EmitterSubscription,
  GestureResponderEvent,
  Clipboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AppState,
  StatusBar,
  Alert,
  Dimensions,
  Image,
} from 'react-native';
import { Send, Square, CirclePlus, Search, Settings, ArrowDown } from 'lucide-react-native';
import { getModelParamsForDevice } from './Utils';
import { styles, markdownStyles, popoverStyles, menuOptionStyles } from './Syles';
import { Message } from './Message';
import {
  initDatabase,
  saveNewChatHistory,
  saveChatMessage,
  loadChatHistory} from './DatabaseHelper';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from './CustomDrawerContent';
import { useDatabase } from './DatabaseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performBraveSearch } from './BraveSearch';

type ChatScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Chat'>;

interface ChatUIProps {
  historyId?: number;
  onMenuPress: () => void;
  MenuIcon: React.ComponentType<any>;
  navigation: ChatScreenNavigationProp;
  setParentIsTyping: (isTyping: boolean) => void;
}

// Add this component for the typing indicator
const TypingIndicator = () => {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <Text style={{ color: '#fff', opacity: 0.7 }}>
      Thinking{dots}
    </Text>
  );
};

const ChatUI: React.FC<ChatUIProps> = ({ historyId, onMenuPress, MenuIcon, navigation, setParentIsTyping }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [modelLoading, setModelLoading] = useState<boolean>(true);
  const [context, setContext] = useState<LlamaContext>();
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [unsppportedDevice, setUnsupportedDevice] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);
  const [searchModeEnabled, setSearchModeEnabled] = useState(false);
  const { setGlobalHistoryId, loadHistories } = useDatabase();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const chatContext = useRef('');
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const currentHistoryIdRef = useRef(currentHistoryId);

  const systemPrompt = useRef('');
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initDatabase();
    loadSystemPrompt();
  }, []);

  const loadSystemPrompt = async () => {
    try {
      const savedPrompt = await AsyncStorage.getItem('systemPrompt');
      const constantPromptInfo = `
You have access to the internet and can use it to search for information, if it is enabled by the user.
When provided with search results, use them to enhance your responses with current and accurate information.
The search results will be clearly marked with "Search Results:" in the user's messages.
Use these results to provide up-to-date information while maintaining your helpful and professional demeanor.`;

      if (savedPrompt) {
        // For custom prompts, ensure they have the begin/header tags and append constant info
        if (!savedPrompt.includes('<|begin_of_text|>')) {
          systemPrompt.current = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${savedPrompt}\n${constantPromptInfo}\n<|eot_id|>`;
        } else {
          // If the prompt already has the tags, insert constant info before the end tag
          systemPrompt.current = savedPrompt.replace('<|eot_id|>', `${constantPromptInfo}\n<|eot_id|>`);
        }
      } else {
        // Set default prompt only if no saved prompt exists
        systemPrompt.current = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a helpful personal AI assistant. Your name is Chloe, and you will be 
a professional AI assistant trying to answer all your users questions. You are locally
running on the device so you will never share any information outside of the chat.
Be as helpful as possible without being overly friendly. Be empathetic only when users
want to talk and share about personal feelings.${constantPromptInfo}
<|eot_id|>`;
      }
    } catch (error) {
      console.error('Error loading system prompt:', error);
    }
  };

  // Add a listener for when the settings screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadSystemPrompt();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (historyId) {
      handleSelectHistory(historyId);
    } else if (currentHistoryId) {
      // History was deleted from drawer, clear the chat
      setMessages([]);
      setCurrentHistoryId(null);
      currentHistoryIdRef.current = null;
      chatContext.current = '';
    }
  }, [historyId]);  

  const handleSelectHistory = async (historyId: number) => {
    try {
      const messages = await loadChatHistory(historyId);
      setMessages(messages);
      setCurrentHistoryId(historyId);
      rebuildChatContext(messages);
      currentHistoryIdRef.current = historyId;
      setGlobalHistoryId(historyId);
      // Reset scroll button state and scroll to bottom when changing chats
      setShowScrollButton(false);
      setTimeout(() => {
        scrollToBottom();
      }, 100); // Small delay to ensure messages are rendered
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleMenuPress = () => {
    if (navigation) {
      navigation.openDrawer();
    } else {
      onMenuPress();
    }
    Keyboard.dismiss();
  };

  useEffect(() => {
    const modelParams = getModelParamsForDevice();
    if (modelParams == null) {
      setUnsupportedDevice(true)
    }

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
        loadModel();
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
  }, []);

  useEffect(() => {
    setParentIsTyping(isTyping);
  }, [isTyping]);

  const loadModel = async () => {
    console.log("Loading model");
    console.log("Started load and predict");
    try {
      const modelParams = getModelParamsForDevice();
      if (modelParams == null) {
        console.log("Model params null! Unsupported device!");
        return;
      }
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

  const rebuildChatContext = (messages: Message[]) => {
    const userHeader = `<|start_header_id|>user<|end_header_id|>`;
    const assistantHeader = `<|start_header_id|>assistant<|end_header_id|>`;

    const endToken = `<|eot_id|>`;

    for (const idx in messages) {
      const message = messages[idx];
      if (idx == '0') {
        chatContext.current += systemPrompt.current + userHeader + message.text + endToken;
      } else if (message.isUser) {
        chatContext.current += userHeader + message.text + endToken;
      } else {
        chatContext.current += assistantHeader + message.text + endToken;
      }
    }
  }

  const addMessage = useCallback(async (text: string, isUser: boolean) => {
    const newMessage = { id: Date.now(), text, isUser };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    if (currentHistoryIdRef.current) {
      await saveChatMessage(currentHistoryIdRef.current, text, isUser);
      loadHistories();
    } else if (isUser) {
      // Create new chat history for first message
      const newHistoryId = await saveNewChatHistory(
        text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        text
      );
      setCurrentHistoryId(newHistoryId);
      currentHistoryIdRef.current = newHistoryId;
      // reload histories to update chat history list
      loadHistories();
      setGlobalHistoryId(newHistoryId);
      saveChatMessage(newHistoryId, text, isUser);
    }

  }, [currentHistoryId]);


  const handleSend = useCallback(async () => {
    const length = inputText.split(/\s+/).length;
    console.log(`current input length ${length}`);
    if (length > 2000) {
      Toast.show("Text too long, please try something shorter", Toast.SHORT);
      return;
    }

    scrollToBottom();

    // Check if model needs to be loaded
    if (!context) {
      setModelLoading(true);
      // Add loading message
      const loadingMessageId = Date.now();
      const loadingMessage = { id: loadingMessageId, text: "Loading AI model... This may take a few moments.", isUser: false };
      setMessages(prevMessages => [...prevMessages, loadingMessage]);
      
      try {
        await loadModel();
        // Remove loading message after successful load
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== loadingMessageId));
      } catch (error) {
        console.error('Error loading model:', error);
        // Update loading message to error message
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === loadingMessageId 
              ? { ...msg, text: "Failed to load model. Please try sending your message again." }
              : msg
          )
        );
        setModelLoading(false);
        return;
      }
    }

    if (inputText.trim()) {
      Keyboard.dismiss();  // Dismiss keyboard when AI starts typing
      addMessage(inputText, true);
      setInputText('');
      setIsTyping(true);

      let searchResults = '';
      if (searchModeEnabled) {
        try {
          searchResults = await performBraveSearch(getUserMessages(inputText, messages));
        } catch (error) {
          console.log('Search error:', error);
          if (error instanceof Error) {
            Toast.show(error.message, Toast.LONG);
          }
        }
      }

      console.log("searchResults: " + searchResults);

      const firstPrompt = `${systemPrompt.current}<|start_header_id|>user<|end_header_id|> 
      ${inputText}
      ${searchResults ? `\nSearch Results: ${searchResults}` : ''}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

      const otherPrompts = `<|start_header_id|>user<|end_header_id|> 
      ${inputText}
      ${searchResults ? `\nSearch Results: ${searchResults}` : ''}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`

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
            if (data.token == "<|eot_id|>") {
                return;
            }
            
            // Add token to current response
            setCurrentResponse(prev => {
              // Handle special cases for better Markdown formatting
              let token = data.token;
              return prev + token;
            });
            
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
    setShowScrollButton(!bottom);
  }

  function handleContentSizeChange(w: number, h: number): void {
    setContentHeight(h);
  }

  const handleNewChat = useCallback(async () => {
    setMessages([]);
    chatContext.current = '';
    setCurrentHistoryId(null);
    currentHistoryIdRef.current = null;
    setGlobalHistoryId(null);
    // Reset scroll button state when starting a new chat
    setShowScrollButton(false);
    // Focus the input
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  function handleInfoPress(event: GestureResponderEvent): void {
    // do nothing for now, will be implemented later
    setShowInfo(true);
  }

  const handleMessageLongPress = (message: Message) => {
    setSelectedMessage(message);
    setMenuVisible(true);
  };

  const handleCopyText = (text: string) => {
    Clipboard.setString(text);
    Toast.show("Text copied to Clipboard", Toast.SHORT);
    setMenuVisible(false);
  };

  const renderMessage = (message: Message) => (
    <TouchableOpacity
      key={message.id}
      onLongPress={() => handleMessageLongPress(message)}
      delayLongPress={200}
    >
      <View
        style={[
          styles.messageBubble,
          message.isUser ? styles.userMessage : styles.aiMessage
        ]}
      >
        <Markdown style={markdownStyles}>{message.text}</Markdown>
      </View>
    </TouchableOpacity>
  );

  const handleSearchToggle = async () => {
    if (!searchModeEnabled) {
      // Check for API key before enabling search
      const apiKey = await AsyncStorage.getItem('braveApiKey');
      if (!apiKey) {
        Toast.show('Please enter your Brave Search API key in settings to enable web search.', Toast.LONG);
        return;
      }
    }
    setSearchModeEnabled(!searchModeEnabled);
  };

  const getUserMessages = (currentInput: string, messages: Message[]): string => {
    // Get all user messages from history
    const userMessages = messages
      .filter(msg => msg.isUser)
      .map(msg => msg.text);
    
    // Add the current input as the last message
    userMessages.push(currentInput);
    
    // Join all messages with newlines, limited to last 5 messages to keep context relevant
    return userMessages.slice(-5).join('\n');
  };

  // Add initial focus effect after the existing useEffect hooks
  useEffect(() => {
    // Focus the input when component mounts
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100); // Small delay to ensure component is fully mounted
  }, []); // Empty dependency array means this runs once on mount

  if (unsppportedDevice) {
    return (
      <View style={styles.unsupportedContainer}>
        <Text style={styles.unsupportedText}>
        Sorry, this application is not supported on your device.
        Please try accessing it from a compatible device.
        Compatible devices are iPhone 13 Pro, iPhone 14 & newer.
      </Text>
    </View>
    )
  }


  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" />
      <View style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 200,
        zIndex: 1000,
        pointerEvents: menuVisible ? 'auto' : 'none',
      }}>
        <Menu
          opened={menuVisible}
          onBackdropPress={() => setMenuVisible(false)}
        >
          <MenuTrigger />
          <MenuOptions customStyles={popoverStyles(selectedMessage?.isUser || false)}>
            <MenuOption 
              onSelect={() => selectedMessage && handleCopyText(selectedMessage.text)} 
              text="Copy" 
              customStyles={menuOptionStyles}
            />
          </MenuOptions>
        </Menu>
      </View>
      
      <View style={styles.header}>
        <View style={styles.headerLeftButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={handleMenuPress} disabled={isTyping}>
            <MenuIcon color="#fff" size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Settings')} disabled={isTyping}>
            <Settings color="#fff" size={24} />
          </TouchableOpacity>
        </View>
        <Image 
          source={require('./images/MyDeviceAI.png')}
          style={styles.headerLogo}
        />
        <View style={styles.headerRightButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, searchModeEnabled && styles.headerButtonActive]} 
            onPress={handleSearchToggle}
            disabled={isTyping}
          >
            <Search color={searchModeEnabled ? "#28a745" : "#fff"} size={24} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleNewChat} disabled={isTyping}>
            <CirclePlus color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.scrollViewContent}
        onScroll={handleScrollEvent}
        scrollEventThrottle={16}
      >
        {messages.map(renderMessage)}
        {isTyping && (
          <View style={[styles.messageBubble, styles.aiMessage]}>
            {currentResponse ? (
              <Markdown style={markdownStyles}>{currentResponse}</Markdown>
            ) : (
              <TypingIndicator />
            )}
          </View>
        )}
      </ScrollView>

      {showScrollButton && (
        <TouchableOpacity 
          style={styles.scrollToBottomButton}
          onPress={scrollToBottom}
        >
          <ArrowDown color="#fff" size={24} />
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={searchModeEnabled ? "Ask me anything (with web search)" : "Ask me anything, or just chat!"}
          placeholderTextColor="#999"
          ref={textInputRef}
          multiline={true}
          editable={true}
          numberOfLines={2}
        />
        {isTyping ? 
          (<TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <Square color="#fff"></Square>
          </TouchableOpacity>) : 
          (<TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Send color="#fff"></Send>
          </TouchableOpacity>)
        }
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatUI;