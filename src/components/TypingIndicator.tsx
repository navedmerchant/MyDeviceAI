import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';

const TypingIndicator: React.FC = () => {
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
      Loading{dots}
    </Text>
  );
};

export default TypingIndicator; 