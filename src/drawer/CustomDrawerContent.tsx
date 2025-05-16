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
import { Trash2, Settings } from 'lucide-react-native';
import { useDatabase } from '../db/DatabaseContext';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';

// Define the drawer param list type
export type DrawerParamList = {
  Chat: { historyId?: number } | undefined;
  Settings: undefined;
};

// Define the navigation prop type
type DrawerNavigation = CompositeNavigationProp<
  DrawerNavigationProp<DrawerParamList, 'Chat'>,
  DrawerNavigationProp<DrawerParamList>
>;

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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  deleteAllButton: {
    padding: 8,
    borderRadius: 4,
  },
  settingsHeaderButton: {
    padding: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  footer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
});

// Memoize item styles to prevent recreation on each render
const getItemStyles = (isActive: boolean) => [
  styles.historyItem,
  isActive && styles.activeHistoryItem
];

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const { histories, loadHistories, deleteHistory, deleteAllHistories, globalHistoryId, setGlobalHistoryId } = useDatabase();
  const navigation = useNavigation<DrawerNavigation>();

  // Memoize formatDate function
  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  }, []);

  // Memoize getShortLastMessage function
  const getShortLastMessage = useCallback((text: string) => {
    // Remove think tags
    const cleanText = text.replace(/<think>/g, '').replace(/<\/think>/g, '');
    const message = cleanText.slice(0, 50) + (cleanText.length > 50 ? '...' : '');
    return message.trim();
  }, []);

  // Memoize handleSelectHistory
  const handleSelectHistory = useCallback((historyId: number) => {
    navigation.navigate('Chat', { historyId });
    props.navigation.closeDrawer();
  }, [navigation, props.navigation]);

  // Memoize handleDeleteHistory
  const handleDeleteHistory = useCallback((historyId: number) => {
    if (historyId === globalHistoryId) {
      setGlobalHistoryId(null);
      navigation.navigate('Chat', { historyId: undefined });
      props.navigation.closeDrawer();
    }
    deleteHistory(historyId);
  }, [deleteHistory, globalHistoryId, navigation, props.navigation, setGlobalHistoryId]);

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
            setGlobalHistoryId(null);
            navigation.navigate('Chat', { historyId: undefined });
            props.navigation.closeDrawer();
            await deleteAllHistories();
          }
        }
      ]
    );
  }, [deleteAllHistories, navigation, props.navigation, setGlobalHistoryId]);
  
  // Memoize the history item render function with proper dependencies
  const renderHistoryItem = useCallback(({ id, lastMessage, timestamp }: typeof histories[0]) => {
    const itemStyles = getItemStyles(globalHistoryId === id);
    
    return (
      <TouchableOpacity
        key={id}
        style={itemStyles}
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
    );
  }, [formatDate, getShortLastMessage, globalHistoryId, handleDeleteHistory, handleSelectHistory]);

  return (
    <DrawerContentScrollView 
      {...props} 
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.title}>Chats</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <TouchableOpacity
                style={styles.deleteAllButton}
                onPress={handleDeleteAllHistories}
              >
                <Trash2 size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsHeaderButton}
                onPress={() => {
                  navigation.navigate('Settings');
                  props.navigation.closeDrawer();
                }}
              >
                <Settings size={20} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.historiesList}>
            {histories.map(renderHistoryItem)}
          </ScrollView>
        </View>

        <View style={styles.footer}>
          {/* <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              navigation.navigate('Settings');
              props.navigation.closeDrawer();
            }}
          >
            <Settings size={20} color="#fff" />
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </DrawerContentScrollView>
  );
};

export default React.memo(CustomDrawerContent);