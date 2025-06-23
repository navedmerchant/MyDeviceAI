import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';

const SearchingIndicator: React.FC = () => {
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
      Searching the web{dots}
    </Text>
  );
};

export default SearchingIndicator; 