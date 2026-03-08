import React from 'react';
import { View, Text, Image } from 'react-native';
import { styles } from '../Styles';

const EmptyState: React.FC = () => {
  return (
    <View
      style={[
        styles.emptyStateContainer,
        { flex: 1, justifyContent: 'center', alignItems: 'center' },
      ]}>
      <Image
        source={require('../images/MyDeviceAI-NoBG.png')}
        style={[styles.emptyStateLogo, { tintColor: '#d1d1d6' }]}
      />
      <Text style={styles.emptyStateTitle}>MyDeviceAI</Text>
    </View>
  );
};

export default EmptyState;
