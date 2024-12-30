import React, { useState, useEffect } from 'react';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { RouteProp } from '@react-navigation/native';
import { DrawerParamList } from '../App';
import ChatUI from './ChatUI';
import { Menu } from 'lucide-react-native';
import { styles } from './Syles';
import { View } from 'react-native';

type ChatScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Chat'>;
type ChatScreenRouteProp = RouteProp<DrawerParamList, 'Chat'>;

type Props = {
  navigation: ChatScreenNavigationProp;
  route: ChatScreenRouteProp;
};

const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const historyId = route.params?.historyId;
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      swipeEnabled: !isTyping
    });
  }, [isTyping]);

  const handleMenuPress = () => {
    navigation.openDrawer();
  };

  return (
    <View style={styles.chatScreenContainer}>
        <ChatUI
        historyId={historyId}
        onMenuPress={handleMenuPress}
        MenuIcon={Menu}
        navigation={navigation}
        setParentIsTyping={setIsTyping}
        />
    </View>
  );
};

export default ChatScreen;