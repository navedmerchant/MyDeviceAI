import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../Styles';

const StreamingThinkingIndicator: React.FC = () => (
  <View style={styles.streamingThinkingIndicator}>
    <Text style={styles.streamingThinkingText}></Text>
  </View>
);

export default StreamingThinkingIndicator; 