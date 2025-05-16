import React from 'react';
import {
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import { MenuProvider } from 'react-native-popup-menu';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DatabaseProvider } from './src/db/DatabaseContext';
import ChatUI from './src/ChatUI';
import CustomDrawerContent from './src/drawer/CustomDrawerContent';
import 'react-native-gesture-handler';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ContextSettings from './src/screens/ContextSettings';

export type DrawerParamList = {
  Chat: { historyId?: number };
  Settings: undefined;
  ContextSettings: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <DatabaseProvider>
      <MenuProvider customStyles={menuProviderStyles}>
        <NavigationContainer>
          <Drawer.Navigator
            initialRouteName="Chat"
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
              headerShown: false,
              drawerStyle: {
                width: '75%',
                backgroundColor: '#000000',
              },
              drawerType: 'front',
              overlayColor: 'rgba(0, 0, 0, 0.7)',
              swipeEdgeWidth: 100, // Increases the swipe detection area (default is 32)
            }}
          >
            <Drawer.Screen 
              name="Chat"
              component={ChatScreen}
              options={{
                swipeEnabled: true,
              }}
            />
            <Drawer.Screen 
              name="Settings"
              component={SettingsScreen}
              options={{
                swipeEnabled: false,
              }}
            />
            <Drawer.Screen 
              name="ContextSettings"
              component={ContextSettings}
              options={{
                swipeEnabled: false,
              }}
            />
          </Drawer.Navigator>
        </NavigationContainer>
      </MenuProvider>
    </DatabaseProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  chatbotContainer: {
    width: '100%',
    height: '100%',
    padding: 5,
    paddingBottom: 20,
    paddingTop: 60,
    backgroundColor: '#000000',
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

const menuProviderStyles = {
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    opacity: 1,
  },
  menuProviderWrapper: {
    flex: 1,
  },
  menuOptions: {
    optionsContainer: {
      width: 70,
      position: 'relative',
    }
  }
};

export default App;