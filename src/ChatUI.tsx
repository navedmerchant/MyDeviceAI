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
  FlatList,
  Animated,
} from 'react-native';
import { Send, Square, CirclePlus, Search, Settings, ArrowDown, Brain, Copy, Share as ShareIcon, ChevronRight, Menu as MenuIcon } from 'lucide-react-native';
import { getModelParamsForDevice } from './utils/Utils';
import { styles, markdownStyles, popoverStyles, menuOptionStyles } from './Styles';
import { Message } from './model/Message';
import { useRemoteConnection } from './connection/RemoteConnectionContext';
import { ConnectionStatusIcon } from './components/ConnectionStatusIcon';
import { ConnectionDropdownModal } from './components/ConnectionDropdownModal';
import {
  initDatabase,
  saveNewChatHistory,
  saveChatMessage,
  loadChatHistory,
  addContextEmbedding,
  findSimilarContexts,
  addReferenceStatement,
  hasReferenceStatements,
  getReferenceStatements,
  updateReferenceEmbedding,
  findSimilarReferenceEmbeddings
} from './db/DatabaseHelper';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '../App';
import { useDatabase } from './db/DatabaseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { performSearXNGSearch, SearchResult } from './search/SearXNG';
import { Share } from 'react-native';
import { checkLocalNetworkAccess, requestLocalNetworkAccess } from '@generac/react-native-local-network-permission';

// Import the components we moved to separate files
import EmptyState from './components/EmptyState';
import TypingIndicator from './components/TypingIndicator';
import SearchingIndicator from './components/SearchingIndicator';
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
  const contextRef = useRef<LlamaContext | undefined>(undefined);
  const embeddingContextRef = useRef<LlamaContext | undefined>(undefined);
  const [unsppportedDevice, setUnsupportedDevice] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState<number | null>(null);
  const [searchModeEnabled, setSearchModeEnabled] = useState(false);
  const [thinkingModeEnabled, setThinkingModeEnabled] = useState(false);
  const [isQwen3Model, setIsQwen3Model] = useState(true);
  const [contextEnabled, setContextEnabled] = useState(true);
  const { setGlobalHistoryId, loadHistories } = useDatabase();
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isWaitingForModel, setIsWaitingForModel] = useState(false);
  const [showConnectionDropdown, setShowConnectionDropdown] = useState(false);

  // Remote connection
  const { state: remoteState, updateLocalModelStatus, setMode, sendMessage: remoteSendMessage, disconnect: remoteDisconnect, connect: remoteConnect } = useRemoteConnection();

  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const currentHistoryIdRef = useRef(currentHistoryId);
  const searchControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);
  const modelLoadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFloatingKeyboard = useIsFloatingKeyboard(); // Use the custom hook

  // Animated values for progress bar
  const progressBarContainerHeight = useRef(new Animated.Value(0)).current;
  const progressBarOpacity = useRef(new Animated.Value(0)).current;
  const progressBarWidth = useRef(new Animated.Value(0)).current;

  const systemPrompt = useRef('');
  const appState = useRef(AppState.currentState);

  // Handle when a suggested prompt is selected
  const handlePromptSelect = useCallback((prompt: string) => {
    setInputText(prompt);
    // Focus the input field
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  }, []);

  // Check and request local network permission on iOS at app startup
  const checkAndRequestLocalNetworkPermission = useCallback(async () => {
      await requestLocalNetworkAccess();
  }, []);

  useEffect(() => {
    loadSystemPrompt();
    loadContextSettings();
    initializeContext();
    checkAndRequestLocalNetworkPermission();
    loadModel(); // Load the model at startup

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

  const loadContextSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('contextSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setContextEnabled(settings.enabled ?? true);
      }
    } catch (error) {
      console.error('Error loading context settings:', error);
    }
  };

  const saveContextSettings = async (enabled: boolean) => {
    try {
      const settings = { enabled };
      await AsyncStorage.setItem('contextSettings', JSON.stringify(settings));
      setContextEnabled(enabled);
    } catch (error) {
      console.error('Error saving context settings:', error);
    }
  };

  const initializeContext = async () => {
    try {
      await initDatabase();
      await loadEmbeddingModel();
      await initializeReferenceEmbeddings();
    } catch (error) {
      console.error('Error initializing context:', error);
    }
  };

  const loadEmbeddingModel = async () => {
    try {
      embeddingContextRef.current = await initLlama({
        model: 'file://bge-small-en-v1.5-q4_k_m.gguf',
        is_model_asset: true,
        n_ctx: 512,
        n_gpu_layers: 0,
        embedding: true
      });
    } catch (error) {
      console.error('Error loading embedding model:', error);
    }
  };

  const unloadEmbeddingModel = async () => {
    embeddingContextRef.current = undefined;
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

  const addContextMemory = async (text: string, skipSelfReferentialCheck: boolean = false): Promise<boolean> => {
    if (!contextEnabled || !embeddingContextRef.current) return false;

    if (!skipSelfReferentialCheck && !(await isSelfReferential(text))) return false;

    try {
      const embedding = await getEmbedding(text);
      if (!embedding) return false;

      const id = Math.random().toString(36).substring(7);
      return await addContextEmbedding(id, text, embedding);
    } catch (error) {
      console.error('Error adding context:', error);
      return false;
    }
  };

  const findSimilarContext = async (query: string, limit: number = 3) => {
    if (!contextEnabled || !embeddingContextRef.current) return [];

    try {
      const queryEmbedding = await getEmbedding(query);
      if (!queryEmbedding) return [];

      const results = await findSimilarContexts(queryEmbedding, limit);
      
      const RELEVANCE_THRESHOLD = 0.85;
      return results.filter(context => 
        typeof context.distance === 'number' && 
        context.distance <= RELEVANCE_THRESHOLD
      );
    } catch (error) {
      console.error('Error finding similar context:', error);
      return [];
    }
  };

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
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log(`AppState change: ${appState.current} -> ${nextAppState}`);

      // Moving to foreground (works for both iOS and Android)
      // On iOS: inactive/background -> active
      // On Android: background -> active (may skip inactive)
      if (nextAppState === 'active' && appState.current !== 'active') {
        console.log("App coming to foreground")
        // Debounce model loading to avoid rapid state changes during screen lock
        if (modelLoadTimeoutRef.current) {
          clearTimeout(modelLoadTimeoutRef.current);
        }

        modelLoadTimeoutRef.current = setTimeout(() => {
          // Double-check app state is still active after delay
          if (AppState.currentState === 'active') {
            console.log("Loading models after confirmed active state");
            if (!contextRef.current) {
              loadModel();
            }
            if (!embeddingContextRef.current) {
              loadEmbeddingModel();
            }
            // Reconnect to desktop if we were in dynamic mode and have a room code
            if (remoteState.mode === 'dynamic' && remoteState.config?.roomCode) {
              console.log("Reconnecting to desktop after foreground");
              try {
                remoteConnect(remoteState.config.roomCode, false);
              } catch (error) {
                console.error('Failed to reconnect to desktop:', error);
              }
            }
          }
        }, 500); // 500ms delay to avoid rapid transitions

      }
      // Moving to background (works for both iOS and Android)
      // On iOS: active -> inactive -> background
      // On Android: active -> background
      else if (appState.current === 'active' && nextAppState !== 'active') {
        // Clear any pending model loads
        if (modelLoadTimeoutRef.current) {
          clearTimeout(modelLoadTimeoutRef.current);
          modelLoadTimeoutRef.current = null;
        }

        if (isTyping) {
          contextRef.current?.stopCompletion();
        }
        unloadModel();
        unloadEmbeddingModel();
        // Disconnect from desktop when going to background
        // This cleans up both connected peers and peers that are still searching
        if (remoteState.isConnected || remoteState.isRetrying || remoteState.status === 'remote_connecting') {
          console.log("Disconnecting from desktop due to background (cleaning up peer connection)");
          remoteDisconnect();
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      if (modelLoadTimeoutRef.current) {
        clearTimeout(modelLoadTimeoutRef.current);
      }
      subscription.remove();
      unloadModel();
      unloadEmbeddingModel();
    };
  }, [remoteState.isConnected, remoteState.isRetrying]);

  useEffect(() => {
    setParentIsTyping(isTyping);
  }, [isTyping]);

  const loadModel = async () => {
    try {
      setIsLoadingModel(true);
      updateLocalModelStatus(true); // Update remote connection status
      setLoadingProgress(0);

      const modelParams = await getModelParamsForDevice();
      if (modelParams == null) {
        console.log("Model params null! Unsupported device!");
        setIsLoadingModel(false);
        updateLocalModelStatus(false);
        return;
      }

      const newContext = await initLlama(modelParams, (progress: number) => {
        setLoadingProgress(progress);
      });

      contextRef.current = newContext;
      console.log("model loaded successfully");

      // Track which model was loaded
      const activeModelId = await AsyncStorage.getItem('activeModelId');
      await AsyncStorage.setItem('lastLoadedModelId', activeModelId || '');

      // Check if the model is qwen3
      const modelDescription = newContext.model.desc || '';
      setIsQwen3Model(modelDescription.toLowerCase().includes('qwen3'));
    } catch (error) {
      console.log("Error loading model" + error);
      Alert.alert("Failed to load model! please close the app and try again by closing some background apps");
    } finally {
      setIsLoadingModel(false);
      setIsWaitingForModel(false); // Reset waiting state when model is loaded or fails
      updateLocalModelStatus(false); // Model loaded, no longer loading
    }
  }

  const unloadModel = async () => {
    await releaseAllLlama();
    contextRef.current = undefined;
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
    
    // Load new model with progress tracking
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

    // Check if we should use remote connection
    const shouldUseRemote = remoteState.mode === 'dynamic' && remoteState.isConnected;

    if (shouldUseRemote && inputText.trim()) {
      // Handle remote send
      Keyboard.dismiss();
      addMessage(inputText, true);
      const userInput = inputText;
      setInputText('');

      // Reset cancellation flag
      isCancelledRef.current = false;

      let searchResults = '';
      let thumbnails: string[] = [];

      // Perform search if enabled (same as local mode)
      if (searchModeEnabled) {
        setIsSearching(true);
        try {
          searchControllerRef.current = new AbortController();
          const searchResponse: SearchResult = await performSearXNGSearch(
            getUserMessages(userInput, messages),
            searchControllerRef.current.signal
          );
          searchResults = searchResponse.formattedText;
          thumbnails = searchResponse.thumbnails;
          setCurrentThumbnails(thumbnails);
        } catch (error) {
          console.log('Search error:', error);
          if (error instanceof Error) {
            showToast(error.message);
          }
        } finally {
          setIsSearching(false);
          searchControllerRef.current = null;
        }
      }

      // Exit early if user cancelled during search
      if (isCancelledRef.current) {
        return;
      }

      setIsTyping(true);
      setCurrentResponse('');

      let remoteSucceeded = false;

      try {
        // Build user content with search results if available
        const searchResultsPrompt = searchResults ? `\nHere are some search results for your query: ${searchResults} \n\n Use these to enhance your response if needed. Provide all the links at the end of your response. Markdown format the links` : '';
        const searchInstructions = searchModeEnabled ? `\nYou have access to the internet and can use it to search for information.
                When provided with search results, use them to enhance your responses with current and accurate information.
                Use these results to provide up-to-date information while maintaining your helpful and professional demeanor.\n` : '';

        const userContent = `${userInput}${searchInstructions}${searchResultsPrompt}`;

        // Convert message history to OpenAI format
        const openAIMessages = [
          // Add system prompt
          {
            role: 'system',
            content: systemPrompt.current
          },
          // Add conversation history
          ...messages.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: stripThinkingContent(msg.text)
          })),
          // Add current user input with search results
          {
            role: 'user',
            content: userContent
          }
        ];

        // Stream response from desktop
        let accumulatedResponse = '';
        for await (const chunk of remoteSendMessage(
          openAIMessages,
          searchModeEnabled,
          thinkingModeEnabled
        )) {
          accumulatedResponse += chunk;
          setCurrentResponse(accumulatedResponse);
        }

        // Add final response with thumbnails
        if (accumulatedResponse.trim()) {
          addMessage(accumulatedResponse, false, thumbnails);
        }
        remoteSucceeded = true;
      } catch (error) {
        console.error('Remote send failed:', error);
        showToast('Failed to send message to desktop. Using local model...');
        // Fallback - reload input and continue to local processing
        setInputText(userInput);
      } finally {
        setIsTyping(false);
        setCurrentResponse('');
        setCurrentThumbnails([]);
      }

      // Return if remote was successful (don't continue to local processing)
      if (remoteSucceeded) return;
    }

    // Local processing - original code
    // Check if active model has changed and reload if necessary
    const currentActiveModelId = await AsyncStorage.getItem('activeModelId');
    const lastLoadedModelId = await AsyncStorage.getItem('lastLoadedModelId');
    const modelNeedsReload = await AsyncStorage.getItem('modelNeedsReload');

    if (currentActiveModelId !== lastLoadedModelId || modelNeedsReload === 'true') {
      console.log("Model parameters or active model changed, reloading...");
      await reloadModel();
      // Clear the reload flag
      await AsyncStorage.removeItem('modelNeedsReload');
    }

    // Check if model needs to be loaded
    if (!contextRef.current) {
      setIsWaitingForModel(true);
      // Add loading message
      const loadingMessageId = Date.now();
      const loadingMessage = { id: loadingMessageId, text: "Waiting for AI model to be ready. This may take a few moments. The wait maybe longer if the app is starting up for the first time.", isUser: false };
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
        setIsWaitingForModel(false);
        return;
      }

      // Remove loading message after model is ready
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== loadingMessageId));
      setIsWaitingForModel(false);
    }

    if (inputText.trim()) {
      Keyboard.dismiss();  // Dismiss keyboard when AI starts typing
      addMessage(inputText, true);
      setInputText('');
      
      // Reset cancellation flag
      isCancelledRef.current = false;
      
      let searchResults = '';
      let thumbnails: string[] = [];
      
      if (searchModeEnabled) {
        setIsSearching(true);
        try {
          // Create abort controller for search cancellation
          searchControllerRef.current = new AbortController();
          const searchResponse: SearchResult = await performSearXNGSearch(
            getUserMessages(inputText, messages), 
            searchControllerRef.current.signal
          );
          searchResults = searchResponse.formattedText;
          thumbnails = searchResponse.thumbnails;
          setCurrentThumbnails(thumbnails);
        } catch (error) {
          console.log('Search error:', error);
          if (error instanceof Error) {
            showToast(error.message);
          }
        } finally {
          setIsSearching(false);
          searchControllerRef.current = null;
        }
      }
      
      // Exit early if user cancelled
      if (isCancelledRef.current) {
        return;
      }
      
      // Only proceed with AI processing if not cancelled
      setIsTyping(true);

      // Get relevant context from previous conversations
      let userContext = '';
      const similarContexts = await findSimilarContext(inputText);
      if (similarContexts.length > 0) {
        userContext = "Here's some relevant context from previous conversations:\n" +
          similarContexts.map(context => context.text).join("\n") + "\n\n";
      }

      const searchResultsPrompt = searchResults ? `\nHere are some search results for your query: ${searchResults} \n\n Use these to enhance your response if needed. Provide all the links at the end of your response. Markdown format the links` : '';

      if (!contextRef.current) {
        console.log("context is undefined!")
        return;
      }

      try {
        // Get model parameters from Utils
        const modelParams = await getModelParamsForDevice();
        
        // Do completion using the configured parameters
        const { text, timings } = await contextRef.current.completion(
          {
            messages: [
              {
                role: 'system',
                content: `${isQwen3Model ? (thinkingModeEnabled ? './think' : './no_think') + '\n' : ''}${systemPrompt.current}`
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
            n_predict: modelParams.n_predict,
            temperature: modelParams.temperature,
            top_p: thinkingModeEnabled ? 0.95 : modelParams.top_p,
            top_k: modelParams.top_k,
            min_p: modelParams.min_p,
            stop: modelParams.stop,
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
  }, [inputText, addMessage, searchModeEnabled, thinkingModeEnabled]);

  async function handleStop(event: GestureResponderEvent): Promise<void> {
    
    // If we're currently searching, cancel the search and reset chat state
    if (isSearching && searchControllerRef.current) {
      searchControllerRef.current.abort();
      setIsSearching(false);
      setCurrentResponse('');
      setCurrentThumbnails([]);
      // Set cancellation flag
      isCancelledRef.current = true;
      return;
    }
    
    // If we're typing (AI is processing), stop the completion and reset state
    if (isTyping) {
      await contextRef.current?.stopCompletion();
      setIsTyping(false);
      setCurrentResponse('');
      setCurrentThumbnails([]);
    }
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

  // Remote connection handlers
  const handleConnectionModeChange = useCallback(async (mode: 'local' | 'dynamic') => {
    try {
      await setMode(mode);
    } catch (error) {
      console.error('Failed to change connection mode:', error);
      Alert.alert('Error', 'Failed to change connection mode');
    }
  }, [setMode]);

  const handleSetupConnection = useCallback(() => {
    setShowConnectionDropdown(false);
    navigation.navigate('AdvancedSettings');
  }, [navigation]);

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

  // Handle progress bar animations
  useEffect(() => {
    if (isLoadingModel) {
      // Animate in
      Animated.parallel([
        Animated.timing(progressBarContainerHeight, {
          toValue: 10, // Reduced height to match new design
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(progressBarOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(progressBarContainerHeight, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
        Animated.timing(progressBarOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [isLoadingModel]);

  // Animate progress fill
  useEffect(() => {
    Animated.timing(progressBarWidth, {
      toValue: loadingProgress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [loadingProgress]);

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
          <TouchableOpacity style={styles.headerButton} onPress={handleMenuPress} disabled={isTyping || isSearching}>
            <MenuIcon color="#fff" size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerCenter}
            onPress={() => setShowConnectionDropdown(true)}
            disabled={isTyping || isSearching}
          >
            <Text style={styles.headerText}>MyDeviceAI</Text>
            <ConnectionStatusIcon status={remoteState.status} mode={remoteState.mode} size={16} />
            <ChevronRight color="#fff" size={14} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerRightButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={handleNewChat} disabled={isTyping || isSearching}>
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
          {(isTyping || isSearching) && (
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
              
              {isSearching ? (
                <SearchingIndicator />
              ) : currentResponse ? (
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
          {isQwen3Model && !remoteState.isConnected && (
            <TouchableOpacity
              style={[styles.modeToggleButton, thinkingModeEnabled && styles.modeToggleButtonActive]}
              onPress={handleThinkingToggle}
              disabled={isTyping || isSearching}
            >
              <Brain color={thinkingModeEnabled ? "#28a745" : "#666"} size={20} />
              <Text style={[styles.modeToggleText, thinkingModeEnabled && styles.modeToggleTextActive]}>Think</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.modeToggleButton, searchModeEnabled && styles.modeToggleButtonActive]}
            onPress={handleSearchToggle}
            disabled={isTyping || isSearching}
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
          {(isTyping || isSearching) ? 
            (<TouchableOpacity 
              style={[styles.stopButton, (!currentResponse && !isSearching) && styles.stopButtonDisabled]} 
              onPress={handleStop}
              disabled={!currentResponse && !isSearching}
            >
              <Square color="#fff"></Square>
            </TouchableOpacity>) : 
            (<TouchableOpacity 
              style={[styles.sendButton, isWaitingForModel && styles.sendButtonDisabled]} 
              onPress={handleSend}
              disabled={isWaitingForModel}
            >
              <Send color="#fff"></Send>
            </TouchableOpacity>)
          }
        </View>
      </View>

      {/* Connection Dropdown Modal */}
      <ConnectionDropdownModal
        visible={showConnectionDropdown}
        onClose={() => setShowConnectionDropdown(false)}
        currentMode={remoteState.mode}
        connectionStatus={remoteState.status}
        isConnected={remoteState.isConnected}
        onModeChange={handleConnectionModeChange}
        onSetupPress={handleSetupConnection}
        hasRemoteConfig={remoteState.config !== null}
        retryCount={remoteState.retryCount}
        nextRetryIn={remoteState.nextRetryIn}
        isRetrying={remoteState.isRetrying}
      />
    </KeyboardAvoidingView>
  );
};

export default ChatUI;