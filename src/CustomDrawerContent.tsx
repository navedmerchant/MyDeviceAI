import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Trash2 } from 'lucide-react-native';
import { useDatabase } from './DatabaseContext';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';

// Define the drawer param list type
export type DrawerParamList = {
  Chat: { historyId?: number } | undefined;
};

// Define the navigation prop type
type DrawerNavigation = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, 'Chat'>,
  DrawerNavigationProp<DrawerParamList>
>;

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { histories, loadHistories, deleteHistory, deleteAllHistories, globalHistoryId } = useDatabase();
  const navigation = useNavigation<DrawerNavigation>();

  // Memoize formatDate function
  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  }, []);

  // Memoize getShortLastMessage function
  const getShortLastMessage = useCallback((text: string) => {
    const message = text.slice(0, 50) + (text.length > 50 ? '...' : '');
    return message.trim();
  }, []);

  // Memoize handleSelectHistory
  const handleSelectHistory = useCallback((historyId: number) => {
    navigation.navigate('Chat', { historyId });
    props.navigation.closeDrawer();
  }, [navigation, props.navigation]);

  // Memoize handleDeleteHistory to prevent recreating function for each item
  const handleDeleteHistory = useCallback((historyId: number) => {
    deleteHistory(historyId);
    if (historyId === globalHistoryId) {
      navigation.navigate('Chat');
    }
  }, [deleteHistory, globalHistoryId, navigation]);

  const handleDeleteAllHistories = useCallback(() => {
    Alert.alert(
      'Delete All Chats',
      'Are you sure you want to delete all chats? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAllHistories();
            navigation.navigate('Chat');
            props.navigation.closeDrawer();
          }
        }
      ]
    );
  }, [deleteAllHistories, navigation, props.navigation]);

  useFocusEffect(
    useCallback(() => {
      // This will run every time the drawer is focused
      loadHistories();
    }, [])
  );
  
  // Memoize the history item render function
  const renderHistoryItem = useCallback(({ id, lastMessage, timestamp }: typeof histories[0]) => (
    <TouchableOpacity
      key={id}
      style={[
        styles.historyItem,
        globalHistoryId === id && styles.activeHistoryItem
      ]}
      onPress={() => handleSelectHistory(id)}
    >
      <View style={styles.historyContent}>
        <Markdown style={markdownStyles}>
          {getShortLastMessage(lastMessage)}
        </Markdown>
        <View style={styles.historyFooter}>
          <Text style={styles.historyDate}>
            {formatDate(timestamp)}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteHistory(id)}
      >
        <Trash2 size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  ), [formatDate, getShortLastMessage, globalHistoryId, handleDeleteHistory, handleSelectHistory]);

  return (
    <DrawerContentScrollView {...props} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
      </View>
      <ScrollView style={styles.historiesList}>
        {histories.map(renderHistoryItem)}
      </ScrollView>
    </DrawerContentScrollView>
  );
};

const markdownStyles = {
  body: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  heading1: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  heading2: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  paragraph: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500' as const,
    marginTop: 0,
    marginBottom: 0,
  },
  link: {
    color: '#3498db',
  },
  list: {
    color: '#fff',
  },
  listItem: {
    color: '#fff',
  },
  strong: {
    color: '#fff',
  },
  em: {
    color: '#fff',
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#000000',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  historiesList: {
    flex: 1,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  activeHistoryItem: {
    backgroundColor: '#333',
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  historyLastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  historyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    padding: 8,
  },
});

export default CustomDrawerContent;