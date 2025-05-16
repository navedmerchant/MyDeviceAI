import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { styles, markdownStyles } from '../Styles';

interface ThinkingContentProps {
  content: string;
  isCurrentlyThinking?: boolean;
}

const ThinkingContent: React.FC<ThinkingContentProps> = ({ content, isCurrentlyThinking = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Don't render anything if content is empty or only whitespace
  if (!content || !content.trim()) {
    return null;
  }
  
  const collapsedText = isCurrentlyThinking ? '🤔 Thinking...' : '🤔 Show Thinking Process';

  return (
    <View style={styles.thinkingContainer}>
      <TouchableOpacity 
        style={styles.thinkingHeader} 
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Text style={styles.thinkingHeaderText}>
          {isExpanded ? '🤔 Hide Thinking Process' : collapsedText}
        </Text>
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.thinkingContent}>
          <Markdown style={markdownStyles}>{content}</Markdown>
        </View>
      )}
    </View>
  );
};

export default ThinkingContent; 