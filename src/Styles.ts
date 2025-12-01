import { StyleSheet, Platform } from "react-native";

const styles = StyleSheet.create({
    chatScreenContainer: {
      flex: 1,
      paddingTop: Platform.OS === 'ios' ? 50 : 0,
      paddingBottom: Platform.OS === 'ios' ? 20 : 0,
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
    headerCenter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    headerLogo: {
      width: 32,
      height: 32,
      resizeMode: 'contain',
    },
    headerText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: '600',
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
    progressBarContainer: {
      backgroundColor: '#000',
      paddingHorizontal: 15,
      paddingVertical: 5,
      borderBottomWidth: 1,
      borderBottomColor: '#333',
      justifyContent: 'center',
    },
    progressBarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    progressBarBackground: {
      height: 2,
      backgroundColor: '#333',
      borderRadius: 1,
      flex: 1,
    },
    progressBarFill: {
      height: 2,
      backgroundColor: '#007AFF',
      borderRadius: 1,
    },
    progressText: {
      color: '#fff',
      fontSize: 12,
      minWidth: 35,
      textAlign: 'right',
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
      width: '100%',
      alignSelf: 'flex-start',
      backgroundColor: 'transparent',
    },
    aiMessageContainer: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    userMessageContainer: {
      flexDirection: 'row',
      alignSelf: 'flex-end',
      alignItems: 'center',
      marginBottom: 10,
    },
    messageActionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
      marginLeft: 10,
    },
    userMessageActionsContainer: {
      marginRight: 8,
    },
    messageActionButton: {
      padding: 5,
      marginLeft: 10,
    },
    userMessageText: {
      color: '#FFFFFF',
    },
    aiMessageText: {
      color: '#fff',
    },
    inputContainer: {
      flexDirection: 'column',
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: '#000',
      maxHeight: 120,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    searchIconContainer: {
      position: 'absolute',
      left: 10,
      top: '50%',
      transform: [{ translateY: -10 }],
      padding: 5,
      color: '#fff',
      marginRight: 10,
      borderWidth: 1,
      borderColor: '#444',
      borderRadius: 20,
      backgroundColor: '#1c1c1c',
      minHeight: 50,
      paddingVertical: 10,
      paddingHorizontal: 15,
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
      padding: 10,
      backgroundColor: '#007AFF',
      borderRadius: 20,
    },
    sendButtonDisabled: {
      backgroundColor: '#666',
      opacity: 0.5,
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
      padding: 10,
    },
    stopButtonDisabled: {
      backgroundColor: '#666',
      opacity: 0.5,
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
      backgroundColor: 'rgba(53, 53, 53, 0.3)',
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
    // Empty state styles
    emptyStateContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyStateLogo: {
      width: 100,
      height: 100,
      resizeMode: 'contain',
      marginBottom: 20,
    },
    emptyStateTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      color: '#ddd',
      fontSize: 16,
      marginBottom: 20,
      textAlign: 'center',
    },
    promptsContainer: {
      paddingHorizontal: 10,
      paddingVertical: 15,
      alignItems: 'center',
    },
    promptItem: {
      backgroundColor: '#333',
      padding: 15,
      borderRadius: 10,
      marginHorizontal: 10,
      borderWidth: 1,
      borderColor: '#444',
      width: 260,
      minHeight: 80,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    promptText: {
      fontSize: 14,
      color: '#fff',
    },
    modeToggleContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      paddingBottom: 5,
      paddingLeft: 10,
    },
    modeToggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: '#444',
      marginRight: 10,
    },
    modeToggleButtonActive: {
      backgroundColor: 'rgba(40, 167, 69, 0.2)',
      borderColor: '#28a745',
    },
    modeToggleText: {
      marginLeft: 5,
      fontSize: 12,
      color: '#666',
    },
    modeToggleTextActive: {
      color: '#28a745',
    },
    // Thumbnail gallery styles
    thumbnailContainer: {
      marginTop: 10,
      marginBottom: 5,
    },
    thumbnailList: {
      paddingVertical: 5,
    },
    thumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
      marginRight: 10,
      backgroundColor: '#333',
    },
    expandedImageOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      width: '100%',
      height: '100%',
      elevation: 10,
    },
    expandedImage: {
      width: '100%',
      height: '100%',
      borderRadius: 0,
    },
    closeTapText: {
      position: 'absolute',
      bottom: 30,
      color: '#fff',
      fontSize: 16,
      textAlign: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: 10,
      borderRadius: 20,
    },
    expandedImageContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      elevation: 10,
    },
    closeButton: {
      position: 'absolute',
      top: 50,
      right: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      padding: 10,
      borderRadius: 20,
      zIndex: 10000,
    },
    closeButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    // Model download screen styles
    modelRequirementContainer: {
      flex: 1,
      backgroundColor: '#1c1c1c',
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modelRequirementTitle: {
      color: '#fff',
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 16,
    },
    modelRequirementText: {
      color: '#ddd',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 32,
    },
    modelSection: {
      width: '100%',
      backgroundColor: '#2c2c2c',
      borderRadius: 12,
      padding: 16,
    },
    modelTypeTitle: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    modelDivider: {
      height: 1,
      backgroundColor: '#444',
      marginVertical: 20,
    },
    downloadButton: {
      backgroundColor: '#007AFF',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      gap: 8,
    },
    downloadButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '500',
    },
    downloadProgress: {
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
    },
    downloadProgressText: {
      color: '#fff',
      fontSize: 14,
    },
    modelInfo: {
      backgroundColor: '#1a1a1a',
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#28a745',
    },
    modelInfoText: {
      color: '#28a745',
      fontSize: 14,
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