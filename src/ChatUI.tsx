import { LlamaContext, initLlama, releaseAllLlama } from 'llama.rn';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import Markdown from 'react-native-markdown-display';
import { showToast } from './utils/ToastUtils';

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
  FlatList,
} from 'react-native';
import { Send, Square, CirclePlus, Search, Settings, ArrowDown, Brain, Copy, Share as ShareIcon } from 'lucide-react-native';
import { getModelParamsForDevice } from './utils/Utils';
import { styles, markdownStyles, popoverStyles, menuOptionStyles } from './Styles';
import { Message } from './model/Message';
import {
  initDatabase,
  saveNewChatHistory,
  saveChatMessage,
  loadChatHistory} from './db/DatabaseHelper';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../App';
import { useDatabase } from './db/DatabaseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performSearXNGSearch, SearchResult } from './search/SearXNG';
import ContextManager from './utils/ContextManager';
import { Share } from 'react-native';

// Import the components we moved to separate files
import EmptyState from './components/EmptyState';
import TypingIndicator from './components/TypingIndicator';
import ThinkingContent from './components/ThinkingContent';
import StreamingThinkingIndicator from './components/StreamingThinkingIndicator';
import ThumbnailGallery from './components/ThumbnailGallery';

type ChatScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Chat'>;

// Add KeyboardEvent type for keyboardWillChangeFrame listener
interface KeyboardEvent {
  endCoordinates: {
    width: number;
    screenX: number;
    screenY: number;
    height: number;
  };
  // Add other properties if needed based on the actual event structure
}

interface ChatUIProps {
  historyId?: number;
  onMenuPress: () => void;
  MenuIcon: React.ComponentType<any>;
  navigation: ChatScreenNavigationProp;
  setParentIsTyping: (isTyping: boolean) => void;
}

const useIsFloatingKeyboard = () => {
  const [floating, setFloating] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const updateWidth = () => {
      setWindowWidth(Dimensions.get('window').width);
    };

    const dimensionsSubscription = Dimensions.addEventListener('change', updateWidth);

    const onKeyboardWillChangeFrame = (event: KeyboardEvent) => {
      // Check if the platform is iOS and then if the keyboard is floating
      if (Platform.OS === 'ios') {
        // Use the current windowWidth from state
        setFloating(event.endCoordinates.width !== windowWidth);
      } else {
        setFloating(false); // On Android, or if not iOS, assume not floating
      }
    };

    const keyboardListener = Keyboard.addListener('keyboardWillChangeFrame', onKeyboardWillChangeFrame as any); // Use 'as any' if type conflict

    return () => {
      keyboardListener.remove();
      dimensionsSubscription?.remove();
    };
  }, [windowWidth]); // Add windowWidth to dependency array

  return floating;
};

const ChatUI: React.FC<ChatUIProps> = ({ historyId, onMenuPress, MenuIcon, navigation, setParentIsTyping }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [currentThumbnails, setCurrentThumbnails] = useState<string[]>([]);
  const contextRef = useRef<LlamaContext | undefined>();
  const [unsppportedDevice, setUnsupportedDevice] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);
  const [searchModeEnabled, setSearchModeEnabled] = useState(false);
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(false);
  const { setGlobalHistoryId, loadHistories } = useDatabase();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const currentHistoryIdRef = useRef(currentHistoryId);
  const isFloatingKeyboard = useIsFloatingKeyboard(); // Use the custom hook

  const systemPrompt = useRef('');
  const appState = useRef(AppState.currentState);
  const contextManager = useRef(ContextManager.getInstance());

  // Handle when a suggested prompt is selected
  const handlePromptSelect = useCallback((prompt: string) => {
    setInputText(prompt);
    // Focus the input field
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    loadSystemPrompt();

    // Add keyboard listeners
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardOffset(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardOffset(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const loadSystemPrompt = async () => {
    try {
      const savedPrompt = await AsyncStorage.getItem('systemPrompt');

      if (savedPrompt) {
        systemPrompt.current = savedPrompt;
      } else {
        // Set default prompt only if no saved prompt exists
        systemPrompt.current = `You are a helpful personal AI assistant. Your name is Chloe, and you will be 
a professional AI assistant trying to answer all your users questions. You are locally
running on the device so you will never share any information outside of the chat.
Be as helpful as possible without being overly friendly. Be empathetic only when users
want to talk and share about personal feelings.`;
      }
    } catch (error) {
      console.error('Error loading system prompt:', error);
    }
  };

  // Load toggle states from AsyncStorage
  const loadToggleStates = async () => {
    try {
      const savedThinkingMode = await AsyncStorage.getItem('thinkingModeEnabled');
      const savedSearchMode = await AsyncStorage.getItem('searchModeEnabled');
      
      if (savedThinkingMode !== null) {
        setThinkingModeEnabled(savedThinkingMode === 'true');
      }
      if (savedSearchMode !== null) {
        setSearchModeEnabled(savedSearchMode === 'true');
      }
    } catch (error) {
      console.error('Error loading toggle states:', error);
    }
  };

  // Add initial load of toggle states
  useEffect(() => {
    loadToggleStates();
  }, []);

  // Add a listener for when the settings screen is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => {
      loadSystemPrompt();
      
      // Check if active model has changed
      const currentActiveModelId = await AsyncStorage.getItem('activeModelId');
      const storedActiveModelId = await AsyncStorage.getItem('lastLoadedModelId');
      
      if (currentActiveModelId !== storedActiveModelId) {
        console.log(`Active model changed from ${storedActiveModelId} to ${currentActiveModelId}`);
        await reloadModel();
        await AsyncStorage.setItem('lastLoadedModelId', currentActiveModelId || '');
      }
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (historyId) {
      handleSelectHistory(historyId);
    } else {
      // History was deleted or we're starting fresh
      setMessages([]);
      setCurrentHistoryId(null);
      currentHistoryIdRef.current = null;
      setCurrentResponse('');
    }
  }, [historyId]);  

  const handleSelectHistory = async (historyId: number) => {
    try {
      const messages = await loadChatHistory(historyId);
      setMessages(messages);
      setCurrentHistoryId(historyId);
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
    const checkDeviceSupport = async () => {
      const modelParams = await getModelParamsForDevice();
      if (modelParams == null) {
        setUnsupportedDevice(true)
      }
    };
    checkDeviceSupport();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        loadModel();
        // Initialize context manager
        contextManager.current.initialize().catch(error => {
          console.error('Error initializing context manager:', error);
        });
      } else if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        if (isTyping) {
          contextRef.current?.stopCompletion();
        }
        unloadModel();
        // Unload context manager
        contextManager.current.unloadModel().catch(error => {
          console.error('Error unloading context manager:', error);
        });
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      unloadModel();
      contextManager.current.unloadModel().catch(error => {
        console.error('Error unloading context manager:', error);
      });
    };
  }, []);

  useEffect(() => {
    setParentIsTyping(isTyping);
  }, [isTyping]);

  const loadModel = async () => {
    try {
      const modelParams = await getModelParamsForDevice();
      if (modelParams == null) {
        console.log("Model params null! Unsupported device!");
        return;
      }
      const newContext = await initLlama(modelParams);
      contextRef.current = newContext;
      console.log("model loaded successfully");
      
      // Track which model was loaded
      const activeModelId = await AsyncStorage.getItem('activeModelId');
      await AsyncStorage.setItem('lastLoadedModelId', activeModelId || '');
    } catch (error) {
      console.log("Error loading model" + error);
      Alert.alert("Failed to load model! please close the app and try again by closing some background apps");
    }
  }

  const unloadModel = async () => {
    await releaseAllLlama();
  }

  const reloadModel = async () => {
    console.log("Reloading model due to active model change...");
    
    // Stop any ongoing completion
    if (isTyping) {
      await contextRef.current?.stopCompletion();
      setIsTyping(false);
      setCurrentResponse('');
    }
    
    // Unload current model
    await unloadModel();
    contextRef.current = undefined;
    
    // Load new model
    await loadModel();
  };

  // Helper function to strip thinking content from text
  const stripThinkingContent = (text: string): string => {
    return text.replace(/<think>.*?<\/think>/gs, '').trim();
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const addMessage = useCallback(async (text: string, isUser: boolean, thumbnails?: string[]) => {
    const newMessage = { id: Date.now(), text, isUser, thumbnails };
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
    if (length > 2000) {
      showToast("Text too long, please try something shorter");
      return;
    }
    
    scrollToBottom();

    // Check if active model has changed and reload if necessary
    const currentActiveModelId = await AsyncStorage.getItem('activeModelId');
    const lastLoadedModelId = await AsyncStorage.getItem('lastLoadedModelId');
    
    if (currentActiveModelId !== lastLoadedModelId) {
      console.log("Active model changed, reloading...");
      await reloadModel();
    }

    // Check if model needs to be loaded
    if (!contextRef.current) {
      // Add loading message
      const loadingMessageId = Date.now();
      const loadingMessage = { id: loadingMessageId, text: "Waiting for AI model to be ready... This may take a few moments.", isUser: false };
      setMessages(prevMessages => [...prevMessages, loadingMessage]);
      
      // Wait for the model to be loaded (max 30 seconds)
      let attempts = 0;
      const maxAttempts = 30;
      while (!contextRef.current && attempts < maxAttempts) {
        console.log("Waiting for model to be loaded...");
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
      }

      if (!contextRef.current) {
        // Update loading message to error message if model still not loaded
        setMessages(prevMessages => 
          prevMessages.map(msg => 
            msg.id === loadingMessageId 
              ? { ...msg, text: "Model is taking too long to load. Please try again later." }
              : msg
          )
        );
        return;
      }

      // Remove loading message after model is ready
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== loadingMessageId));
    }

    if (inputText.trim()) {
      Keyboard.dismiss();  // Dismiss keyboard when AI starts typing
      addMessage(inputText, true);
      setInputText('');
      setIsTyping(true);

      let searchResults = '';
      let thumbnails: string[] = [];
      
      if (searchModeEnabled) {
        try {
          const searchResponse: SearchResult = await performSearXNGSearch(getUserMessages(inputText, messages));
          searchResults = searchResponse.formattedText;
          thumbnails = searchResponse.thumbnails;
          setCurrentThumbnails(thumbnails);
        } catch (error) {
          console.log('Search error:', error);
          if (error instanceof Error) {
            showToast(error.message);
          }
        }
      }

      // Get relevant context from previous conversations
      let userContext = '';
      if (contextManager.current) {
        const similarContexts = await contextManager.current.findSimilarContext(inputText);
        // print list of similar contexts
        console.log("similar contexts: " + similarContexts.length);
        if (similarContexts.length > 0) {
          userContext = "Here's some relevant context from previous conversations:\n" +
            similarContexts.map(context => context.text).join("\n") + "\n\n";
        }
      }

      const searchResultsPrompt = searchResults ? `\nHere are some search results for your query: ${searchResults} \n\n Use these to enhance your response if needed. Provide all the links at the end of your response. Markdown format the links` : '';

      if (!contextRef.current) {
        console.log("context is undefined!")
        return;
      }

      try {
        // Do completion
        const { text, timings } = await contextRef.current.completion(
          {
            messages: [
              {
                role: 'system',
                content: `${thinkingModeEnabled ? './think' : './no_think'}\n${systemPrompt.current}`
              },
              ...messages.map(msg => ({
                role: msg.isUser ? 'user' : 'assistant',
                content: stripThinkingContent(msg.text)
              })),
              {
                role: 'user',
                content: `${inputText}
                ${searchModeEnabled ? `\nYou have access to the internet and can use it to search for information.
                When provided with search results, use them to enhance your responses with current and accurate information.
                Use these results to provide up-to-date information while maintaining your helpful and professional demeanor.\n` : ''}
                ${searchResultsPrompt}
                ${userContext}`
              }
            ],
            n_predict: 4096,
            temperature: 0.7,
            top_p: thinkingModeEnabled ? 0.95 : 0.8,
            top_k: 20,
            min_p: 0,
            stop: ['<|im_end|>', '<|im_start|>', '<|end|>', '<|user|>', '<|assistant|>', 'User:', 'Assistant:', 'Human:', 'AI:', '<|eot_id|>'],
          },
          (data: { token: string }) => {
            // Add token to current response
            setCurrentResponse(prev => prev + data.token);
          },
        )
        const displayText = text.trim();
        addMessage(displayText, false, thumbnails);
      } catch (error) {
        console.error('Error generating AI response:', error);
        addMessage('Sorry, I encountered an error. Please try again.', false);
      } finally {
        setIsTyping(false);
        setCurrentResponse('');
        setCurrentThumbnails([]);
      }
    }
  }, [inputText, addMessage, contextManager, searchModeEnabled, thinkingModeEnabled]);

  async function handleStop(event: GestureResponderEvent): Promise<void> {
    await contextRef.current?.stopCompletion();
    setIsTyping(false);
  }

  const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize} : NativeScrollEvent) => {
    const paddingToBottom = 20;
    return layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  function handleScrollEvent(event: NativeSyntheticEvent<NativeScrollEvent>): void {
    const bottom = isCloseToBottom(event.nativeEvent);
    setShowScrollButton(!bottom);
  }

  const handleNewChat = useCallback(async () => {
    setMessages([]);
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

  const handleCopyText = (text: string) => {
    const textWithoutThinking = text.replace(/<think>.*?<\/think>/gs, '').trim();
    Clipboard.setString(textWithoutThinking);
    showToast("Text copied to Clipboard");
  };

  // Add this function to handle sharing text
  const handleShareText = async (text: string) => {
    try {
      // Strip out thinking sections from the message text before sharing
      const textWithoutThinking = text.replace(/<think>.*?<\/think>/gs, '').trim();
      await Share.share({
        message: textWithoutThinking,
      });
    } catch (error) {
      console.error('Error sharing text:', error);
      showToast("Failed to share text.");
    }
  };

  // Move processThinkingContent outside of renderMessage
  const processThinkingContent = (text: string, isCurrentlyThinking: boolean = false) => {
    // Find the first <think> tag
    const startIndex = text.indexOf("<think>");
    if (startIndex === -1) {
      // No thinking content
      return <Markdown style={markdownStyles}>{text}</Markdown>;
    }

    // Find the last </think> tag
    const endIndex = text.lastIndexOf("</think>");
    
    const parts = [];
    
    // Add text before thinking section
    if (startIndex > 0) {
      parts.push(
        <Markdown key="pre-think" style={markdownStyles}>
          {text.slice(0, startIndex)}
        </Markdown>
      );
    }
    
    // Get thinking content
    const thinkingContent = endIndex !== -1 
      ? text.slice(startIndex + 7, endIndex) // +7 to skip "<think>"
      : text.slice(startIndex + 7); // if no closing tag, take until the end
    
    // Only add thinking content if it's not empty
    const trimmedThinkingContent = thinkingContent.trim();
    if (trimmedThinkingContent) {
      parts.push(
        <ThinkingContent key="thinking" content={trimmedThinkingContent} isCurrentlyThinking={isCurrentlyThinking} />
      );
    }
    
    // Add text after thinking section (if there was a closing tag)
    if (endIndex !== -1 && endIndex + 8 < text.length) { // +8 for "</think>"
      // If there was no thinking content, join the before and after text
      const afterText = text.slice(endIndex + 8);
      if (!trimmedThinkingContent) {
        parts.push(
          <Markdown key="combined" style={markdownStyles}>
            {afterText}
          </Markdown>
        );
      } else {
        parts.push(
          <Markdown key="post-think" style={markdownStyles}>
            {afterText}
          </Markdown>
        );
      }
    }
    
    return parts.length > 0 ? parts : <Markdown style={markdownStyles}>{text}</Markdown>;
  };

  const handleImagePress = (url: string, allImages: string[]) => {
    const initialIndex = allImages.findIndex(image => image === url);
    navigation.navigate('ImageGallery', {
      images: allImages,
      initialIndex: initialIndex >= 0 ? initialIndex : 0,
    });
  };

  const renderMessage = (message: Message) => {
    const isAIMessage = !message.isUser;

    return (
      <View key={message.id} style={isAIMessage ? styles.aiMessageContainer : styles.userMessageContainer}>
        {/* For user messages, show copy button on the left */} 
        {!isAIMessage && (
          <View style={styles.userMessageActionsContainer}> 
            <TouchableOpacity onPress={() => handleCopyText(message.text)} style={styles.messageActionButton}>
              <Copy color="#aaa" size={18} />
            </TouchableOpacity>
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isAIMessage ? styles.aiMessage : styles.userMessage,
            isAIMessage && { maxWidth: '100%' } // Override maxWidth for AI messages
          ]}
        >
          {/* Show thumbnails at the top for AI messages */}
          {isAIMessage && message.thumbnails && message.thumbnails.length > 0 && (
            <ThumbnailGallery 
              thumbnails={message.thumbnails} 
              onImagePress={(url) => handleImagePress(url, message.thumbnails || [])} 
            />
          )}
          
          {processThinkingContent(message.text, false)}
        </View>
        {/* For AI messages, show copy and share buttons on the right/below */} 
        {isAIMessage && (
          <View style={styles.messageActionsContainer}>
            <TouchableOpacity onPress={() => handleCopyText(message.text)} style={styles.messageActionButton}>
              <Copy color="#aaa" size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleShareText(message.text)} style={styles.messageActionButton}>
              <ShareIcon color="#aaa" size={18} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const handleSearchToggle = async () => {
    const newState = !searchModeEnabled;
    setSearchModeEnabled(newState);
    try {
      await AsyncStorage.setItem('searchModeEnabled', newState.toString());
    } catch (error) {
      console.error('Error saving search mode state:', error);
    }
  };

  const handleThinkingToggle = async () => {
    const newState = !thinkingModeEnabled;
    setThinkingModeEnabled(newState);
    try {
      await AsyncStorage.setItem('thinkingModeEnabled', newState.toString());
    } catch (error) {
      console.error('Error saving thinking mode state:', error);
    }
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
      enabled={!isFloatingKeyboard} // Disable on iOS if keyboard is floating
    >
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.headerLeftButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={handleMenuPress} disabled={isTyping}>
            <MenuIcon color="#fff" size={24} />
          </TouchableOpacity>
        </View>
        <Image 
          source={require('./images/MyDeviceAI-NoBG.png')}
          style={styles.headerLogo}
        />
        <View style={styles.headerRightButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={handleNewChat} disabled={isTyping}>
            <CirclePlus color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      {messages.length === 0 ? (
        <EmptyState onPromptPress={handlePromptSelect} />
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.scrollViewContent}
          onScroll={handleScrollEvent}
          scrollEventThrottle={16}
        >
          {messages.map(renderMessage)}
          {isTyping && (
            <View style={[
              styles.messageBubble,
              styles.aiMessage,
              { maxWidth: '100%' }
            ]}>
              {currentThumbnails.length > 0 && (
                <ThumbnailGallery 
                  thumbnails={currentThumbnails} 
                  onImagePress={(url) => handleImagePress(url, currentThumbnails)} 
                />
              )}
              
              {currentResponse ? (
                <>
                  {processThinkingContent(currentResponse, true)}
                  {(currentResponse.match(/<think>/g) || []).length > 
                   (currentResponse.match(/<\/think>/g) || []).length && (
                    <StreamingThinkingIndicator />
                  )}
                </>
              ) : (
                <TypingIndicator />
              )}
            </View>
          )}
        </ScrollView>
      )}

      {showScrollButton && messages.length > 0 && (
        <TouchableOpacity 
          style={[
            styles.scrollToBottomButton,
            { bottom: 120 + keyboardOffset }
          ]}
          onPress={scrollToBottom}
        >
          <ArrowDown color="#fff" size={24} />
        </TouchableOpacity>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity 
            style={[styles.modeToggleButton, thinkingModeEnabled && styles.modeToggleButtonActive]} 
            onPress={handleThinkingToggle}
            disabled={isTyping}
          >
            <Brain color={thinkingModeEnabled ? "#28a745" : "#666"} size={20} />
            <Text style={[styles.modeToggleText, thinkingModeEnabled && styles.modeToggleTextActive]}>Think</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modeToggleButton, searchModeEnabled && styles.modeToggleButtonActive]} 
            onPress={handleSearchToggle}
            disabled={isTyping}
          >
            <Search color={searchModeEnabled ? "#28a745" : "#666"} size={20} />
            <Text style={[styles.modeToggleText, searchModeEnabled && styles.modeToggleTextActive]}>Search</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[styles.input, { maxHeight: 60 }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={"Ask me anything, or just chat!"}
            placeholderTextColor="#999"
            ref={textInputRef}
            multiline={true}
            editable={true}
            numberOfLines={2}
            onFocus={() => setTimeout(scrollToBottom, 100)}
          />
          {isTyping ? 
            (<TouchableOpacity 
              style={[styles.stopButton, !currentResponse && styles.stopButtonDisabled]} 
              onPress={handleStop}
              disabled={!currentResponse}
            >
              <Square color="#fff"></Square>
            </TouchableOpacity>) : 
            (<TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Send color="#fff"></Send>
            </TouchableOpacity>)
          }
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatUI;