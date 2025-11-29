/**
 * Connection Dropdown Modal Component
 * Displays connection mode options and status
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Check } from 'lucide-react-native';
import type { ConnectionMode, ConnectionStatus } from '../types/RemoteConnection';

interface ConnectionDropdownModalProps {
  visible: boolean;
  onClose: () => void;
  currentMode: ConnectionMode;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  onModeChange: (mode: ConnectionMode) => void;
  onSetupPress: () => void;
  hasRemoteConfig: boolean;
}

/**
 * Get status description text
 */
function getStatusText(status: ConnectionStatus, isConnected: boolean): string {
  if (isConnected) {
    return 'Connected to Desktop';
  }

  switch (status) {
    case 'remote_connecting':
      return 'Connecting to Desktop...';
    case 'remote_error':
      return 'Desktop Offline';
    case 'local_loading':
      return 'Loading Local Model...';
    case 'local_ready':
      return 'Using Local Model';
    default:
      return 'Ready';
  }
}

export function ConnectionDropdownModal({
  visible,
  onClose,
  currentMode,
  connectionStatus,
  isConnected,
  onModeChange,
  onSetupPress,
  hasRemoteConfig,
}: ConnectionDropdownModalProps) {
  const statusText = getStatusText(connectionStatus, isConnected);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={styles.dropdown}>
          {/* Status Section */}
          <View style={styles.statusSection}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Mode Options */}
          <View style={styles.optionsSection}>
            <Text style={styles.sectionTitle}>Connection Mode</Text>

            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                onModeChange('local');
                onClose();
              }}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionText}>Local</Text>
                <Text style={styles.optionDescription}>
                  Always use local model
                </Text>
              </View>
              {currentMode === 'local' && (
                <Check color="#4CAF50" size={20} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, !hasRemoteConfig && styles.optionDisabled]}
              onPress={() => {
                if (hasRemoteConfig) {
                  onModeChange('dynamic');
                  onClose();
                }
              }}
              disabled={!hasRemoteConfig}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.optionText, !hasRemoteConfig && styles.optionTextDisabled]}>
                  Dynamic
                </Text>
                <Text style={[styles.optionDescription, !hasRemoteConfig && styles.optionDescriptionDisabled]}>
                  {hasRemoteConfig
                    ? 'Prefer desktop when available'
                    : 'Setup connection first'}
                </Text>
              </View>
              {currentMode === 'dynamic' && hasRemoteConfig && (
                <Check color="#4CAF50" size={20} />
              )}
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Setup Button */}
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => {
              onSetupPress();
              onClose();
            }}
          >
            <Text style={styles.setupButtonText}>Setup Connection</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 60, // Position below header
  },
  dropdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  statusSection: {
    padding: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
  },
  optionsSection: {
    padding: 16,
  },
  sectionTitle: {
    color: '#999',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  optionTextDisabled: {
    color: '#666',
  },
  optionDescription: {
    color: '#999',
    fontSize: 13,
  },
  optionDescriptionDisabled: {
    color: '#666',
  },
  setupButton: {
    padding: 16,
    alignItems: 'center',
  },
  setupButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
});
