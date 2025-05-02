import { StyleSheet, Platform } from "react-native";

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
    headerLeftButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    headerLogo: {
      width: 40,
      height: 40,
      resizeMode: 'contain',
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
    headerButtonActive: {
      padding: 5,
      color: '#28a745',
      fontWeight: 'bold',
    },
    headerRightButtons: {
      flexDirection: 'row',
      alignItems: "center",
      gap: 5,
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
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 10,
      borderWidth: 1,
      borderColor: '#ccc',
      borderRadius: 20,
      backgroundColor: 'transparent',
    },
    searchIconContainer: {
      paddingLeft: 12,
      paddingRight: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      paddingHorizontal: 15,
      paddingVertical: 10,
      color: '#fff',
    },
    inputWithIcon: {
      paddingLeft: 5,
    },
    sendButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#007AFF',
      borderRadius: 20,
      paddingHorizontal: 20,
    },
    searchButton: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#28a745',
      borderRadius: 20,
      paddingHorizontal: 20,
      marginRight: 10,
    },
    searchButtonActive: {
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#1e7e34',
      borderRadius: 20,
      paddingHorizontal: 20,
      marginRight: 10,
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
    scrollToBottomButton: {
      position: 'absolute',
      right: 20,
      bottom: 90,
      backgroundColor: '#007AFF',
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    thinkingContainer: {
      marginVertical: 5,
      borderRadius: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
    },
    thinkingHeader: {
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(125, 23, 176, 0.3)',
    },
    thinkingHeaderText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    thinkingContent: {
      padding: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    streamingThinkingIndicator: {
      marginTop: 5,
      alignSelf: 'flex-start',
    },
    streamingThinkingText: {
      fontSize: 20,
    },
  });
  
  const markdownStyles = {
    text: {
      color: '#fff', // White text
      fontSize: 16,
      lineHeight: 22,
    },
    heading1: {
      color: '#fff', // White heading
      fontSize: 24,
      marginTop: 10,
      marginBottom: 8,
    },
    heading2: {
      color: '#fff',
      fontSize: 20,
      marginTop: 8,
      marginBottom: 6,
    },
    heading3: {
      color: '#fff',
      fontSize: 18,
      marginTop: 6,
      marginBottom: 4,
    },
    strong: {
      color: '#fff', // White bold text
      fontWeight: 'bold' as const,
    },
    em: {
      color: '#fff', // White italic text
      fontStyle: 'italic' as const,
    },
    link: {
      color: '#1E90FF', // Blue color for links
      textDecorationLine: 'underline' as const,
    },
    list_item: {
      color: '#fff', // White list items
      marginBottom: 4,
    },
    bullet_list: {
      marginVertical: 6,
    },
    ordered_list: {
      marginVertical: 6,
    },
    code_block: {
      backgroundColor: '#f0f0f0',
      padding: 10,
      borderRadius: 4,
      marginVertical: 8,
    },
    code: {
      color: '#000', // code should be black
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      backgroundColor: '#f0f0f0',
      padding: 10,
      borderRadius: 4,
    },
    code_inline: {
      color: '#000',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      backgroundColor: '#f0f0f0',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 3,
    },
    blockquote: {
      borderLeftWidth: 4,
      borderLeftColor: '#1E90FF',
      paddingLeft: 10,
      marginLeft: 10,
      marginVertical: 8,
    },
    hr: {
      backgroundColor: '#555',
      height: 1,
      marginVertical: 10,
    },
    table: {
      borderWidth: 1,
      borderColor: '#555',
      marginVertical: 10,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: '#555',
    },
    th: {
      padding: 6,
      backgroundColor: '#333',
    },
    td: {
      padding: 6,
    }
  }
  
  const popoverStyles = (isUser: boolean) => ({
    optionsContainer: {
      backgroundColor: '#2c2c2c',
      padding: 5,
      borderRadius: 8,
      width: 70,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5
    }
  });
  
  const menuOptionStyles = {
    optionWrapper: {
      padding: 10,
      backgroundColor: '#2c2c2c',
    },
    optionText: {
      color: '#fff',
      fontSize: 16,
    },
  };

export {styles, markdownStyles, popoverStyles, menuOptionStyles}