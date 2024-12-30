import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
    chatScreenContainer: {
      flex: 1,
      paddingTop: 50,
      paddingBottom: 20,
      backgroundColor: '#000',
    },
    container: {
      flex: 1,
      backgroundColor: '#1c1c1c',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 10,
      backgroundColor: '#000',
    },
    headerTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
    },
    headerButton: {
      padding: 5,
      color: '#fff',
      fontWeight: 'bold',
    },
    messagesContainer: {
      flex: 1,
    },
    scrollViewContent: {
      padding: 10,
      paddingBottom: 20,
    },
    messageBubble: {
      maxWidth: '80%',
      padding: 10,
      borderRadius: 20,
      marginBottom: 10,
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#007AFF',
    },
    aiMessage: {
      width: '80%',
      alignSelf: 'flex-start',
      backgroundColor: '#7d17b0',
    },
    userMessageText: {
      color: '#FFFFFF',
    },
    aiMessageText: {
      color: '#fff',
    },
    inputContainer: {
      flexDirection: 'row',
      padding: 10,
      backgroundColor: '#000',
      maxHeight: 80
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginRight: 10,
      color: '#fff',
    },
    sendButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#007AFF',
      borderRadius: 20,
      paddingHorizontal: 20,
    },
    stopButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#c20a10',
      borderRadius: 20,
      paddingHorizontal: 20,
    },
    sendButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    clearButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#2b2727',
      borderRadius: 20,
      paddingHorizontal: 15,
      marginRight: 10,
    },
    clearButtonText: {
      color: '#fff',
      fontWeight: 'bold',
    },
    infoContainer: {
      flex: 1,
      paddingTop: 60,
      backgroundColor: '#000',
    },
    infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 15,
      backgroundColor: '#000',
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    backButtonText: {
      color: '#fff',
      fontSize: 16,
      marginLeft: 5,
    },
    infoTitle: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
      marginLeft: 85,
    },
    infoContent: {
      flex: 1,
      padding: 15,
    },
    infoSection: {
      marginBottom: 30,
    },
    infoSectionTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    versionText: {
      color: '#999',
      fontSize: 16,
      marginBottom: 10,
    },
    infoDescription: {
      color: '#fff',
      fontSize: 16,
      lineHeight: 22,
    },
    licenseSection: {
      marginBottom: 30,
    },
    licenseSectionTitle: {
      color: '#fff',
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 15,
    },
    licenseItem: {
      marginBottom: 20,
    },
    licenseTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    licenseText: {
      color: '#ccc',
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 5,
    },
    linkText: {
      color: '#007AFF',
      fontSize: 14,
      marginTop: 5,
    },
    copyrightSection: {
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: '#333',
    },
    copyrightText: {
      color: '#999',
      fontSize: 14,
      textAlign: 'center',
    },
    unsupportedContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1c1c1c',
      padding: 16
    },
    unsupportedText: {
      fontSize: 18,
      color: '#fff',
      textAlign: 'center'
    },
  });
  
  const markdownStyles = {
    text: {
      color: '#fff', // White text
    },
    heading1: {
      color: '#fff', // White heading
    },
    strong: {
      color: '#fff', // White bold text
    },
    em: {
      color: '#fff', // White italic text
    },
    link: {
      color: '#1E90FF', // Blue color for links
    },
    list_item: {
      color: '#fff', // White list items
    },
    code: {
      color: '#000' // code should be black
    },
    code_inline: {
      color: '#000'
    },
    blockquote: {
      color: '#000'
    }
  }
  
  const popoverStyles = (isUser: boolean) => ({
    optionsContainer: {
      backgroundColor: '#2c2c2c',
      padding: 5,
      borderRadius: 8,
      width: 70,
      shadowColor: "#000",
      marginLeft: isUser ? 1 : 297, // Adjust these values as needed
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    }
  });
  
  const menuOptionStyles = {
    optionWrapper: {
      padding: 10,
    },
    optionText: {
      color: '#fff',
      fontSize: 16,
    },
  };

export {styles, markdownStyles, popoverStyles, menuOptionStyles}