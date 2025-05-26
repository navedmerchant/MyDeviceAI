import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Keyboard,
  Dimensions
} from 'react-native';
import { styles } from '../Styles';
import { SUGGESTED_PROMPTS } from '../constants/SuggestedPrompts';
import { shuffleArray } from '../utils/ArrayUtils';

// Pre-shuffle the prompts once when the file loads
const SHUFFLED_PROMPTS = shuffleArray([...SUGGESTED_PROMPTS]);

interface EmptyStateProps {
  onPromptPress: (prompt: string) => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onPromptPress }) => {
  const flatListRef = useRef<FlatList>(null);
  // Use the pre-shuffled prompts
  const visiblePrompts = useRef([...SHUFFLED_PROMPTS]);
  const [isPaused, setIsPaused] = useState(false);
  const [userScrollPos, setUserScrollPos] = useState(0);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [shouldShowPrompts, setShouldShowPrompts] = useState(true);
  
  // Auto-scrolling logic
  useEffect(() => {
    let scrollInterval: NodeJS.Timeout;
    let currentScrollPosition = userScrollPos;
    const itemWidth = 280; // Width of each item + horizontal margins
    const totalWidth = SUGGESTED_PROMPTS.length * itemWidth; // Total width of all items
    
    // Start auto-scrolling after a short delay
    const timer = setTimeout(() => {
      scrollInterval = setInterval(() => {
        if (!isPaused) {
          currentScrollPosition += 1; // Slower, smoother scrolling
          
          // Create circular scrolling effect
          const actualPosition = currentScrollPosition % totalWidth;
          
          // Check if we need to update the visible window of prompts
          // This creates an illusion of infinite scrolling with better performance
          if (Math.floor(actualPosition / itemWidth) > SUGGESTED_PROMPTS.length - 10) {
            // Approaching the end, append prompts from beginning to create seamless loop
            visiblePrompts.current = [...SHUFFLED_PROMPTS, ...SHUFFLED_PROMPTS.slice(0, 15)];
          } else if (actualPosition < 10 * itemWidth) {
            // Near the beginning, reset to original list
            visiblePrompts.current = [...SHUFFLED_PROMPTS];
          }
          
          // Smooth scrolling
          flatListRef.current?.scrollToOffset({ 
            offset: actualPosition,
            animated: false 
          });
        }
      }, 20); // Update more frequently for smoother scrolling
    }, 1500); // Start after 1.5 seconds
    
    return () => {
      clearTimeout(timer);
      clearInterval(scrollInterval);
    };
  }, [isPaused, userScrollPos]);
  
  // Handle touch events to pause/resume scrolling
  const handleTouchStart = () => setIsPaused(true);
  const handleTouchEnd = () => setIsPaused(false);
  
  // Track scroll position
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isPaused) {
      setUserScrollPos(event.nativeEvent.contentOffset.x);
    }
  };
  
  // Handle orientation changes
  useEffect(() => {
    const updateOrientation = () => {
      const { width, height } = Dimensions.get('window');
      setIsLandscape(width > height);
    };

    // Set initial orientation
    updateOrientation();

    // Add event listener for orientation changes
    const dimensionsSubscription = Dimensions.addEventListener('change', updateOrientation);

    return () => {
      dimensionsSubscription.remove();
    };
  }, []);

  // Handle keyboard visibility
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Update prompt visibility based on keyboard and orientation
  useEffect(() => {
    if (Platform.OS === 'ios' && Platform.isPad) {
      setShouldShowPrompts(!isKeyboardVisible || !isLandscape);
    } else {
      setShouldShowPrompts(true);
    }
  }, [isKeyboardVisible, isLandscape]);

  return (
    <View 
      style={styles.emptyStateContainer}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Image
        source={require('../images/MyDeviceAI-NoBG.png')}
        style={styles.emptyStateLogo}
      />
      <Text style={styles.emptyStateTitle}>MyDeviceAI</Text>      
      {shouldShowPrompts && (
        <FlatList
          ref={flatListRef}
          data={visiblePrompts.current}
          keyExtractor={(item, index) => `prompt-${index}`}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.promptItem} 
              onPress={() => onPromptPress(item)}
            >
              <Text style={styles.promptText}>{item}</Text>
            </TouchableOpacity>
          )}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToAlignment="center"
          snapToInterval={280} // Match the itemWidth for snap effect
          contentContainerStyle={styles.promptsContainer}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={handleScroll}
          onScrollBeginDrag={() => setIsPaused(true)}
          onScrollEndDrag={() => {
            // Small delay before resuming auto-scroll to allow momentum scrolling to settle
            setTimeout(() => setIsPaused(false), 500);
          }}
          onMomentumScrollEnd={(event) => {
            setUserScrollPos(event.nativeEvent.contentOffset.x);
          }}
          windowSize={10} // Optimize rendering for better performance
          removeClippedSubviews={true} // Improve memory usage
          maxToRenderPerBatch={8} // Limit batch rendering for smoother scrolling
          initialNumToRender={6} // Start with fewer rendered items
        />
      )}
    </View>
  );
};

export default EmptyState; 