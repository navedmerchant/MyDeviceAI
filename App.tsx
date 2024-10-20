import React from 'react';
import {
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';

import {
  Colors,
} from 'react-native/Libraries/NewAppScreen';
import { MenuProvider } from 'react-native-popup-menu'
import ChatUI from './ChatUI';


function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  return (
    <MenuProvider customStyles={menuProviderStyles}>
      <View style={styles.container}>
        <View style={styles.chatbotContainer}>
          <ChatUI></ChatUI>
        </View>
      </View>
    </MenuProvider>
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
    width: '100%', // Adjust the width to your preference
    height: '100%', // Adjust the height to your preference
    padding: 5, // Adds padding inside the container
    paddingBottom: 20,
    paddingTop: 60,
    backgroundColor: '#000000', // Optional: Add background color to the Chatbot container
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
};

export default App;
