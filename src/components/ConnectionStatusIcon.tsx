/**
 * Connection Status Icon Component
 * Displays phone (local) or computer (remote) icon with color-coded status
 */

import React from 'react';
import { Smartphone, Monitor } from 'lucide-react-native';
import type { ConnectionStatus } from '../types/RemoteConnection';

interface ConnectionStatusIconProps {
  status: ConnectionStatus;
  mode?: 'local' | 'dynamic';
  size?: number;
}

/**
 * Get icon color based on connection status
 * Red = loading/error, Green = ready/connected
 */
function getIconColor(status: ConnectionStatus): string {
  switch (status) {
    case 'local_loading':
    case 'remote_error':
      return '#FF4444'; // Red

    case 'local_ready':
    case 'remote_connected':
      return '#4CAF50'; // Green

    case 'remote_connecting':
      return '#FFA726'; // Orange

    default:
      return '#999999'; // Gray
  }
}

/**
 * Get icon component based on connection mode and status
 * Phone icon for local mode, Computer icon for dynamic mode
 */
function getIconComponent(status: ConnectionStatus, mode?: 'local' | 'dynamic'): typeof Smartphone | typeof Monitor {
  // In local mode, always show phone icon
  if (mode === 'local') {
    return Smartphone;
  }

  // In dynamic mode, show appropriate icon based on status
  switch (status) {
    case 'remote_connecting':
    case 'remote_connected':
      return Monitor;

    case 'local_loading':
    case 'local_ready':
    case 'remote_error':
    default:
      return Smartphone;
  }
}

export function ConnectionStatusIcon({ status, mode, size = 20 }: ConnectionStatusIconProps) {
  const IconComponent = getIconComponent(status, mode);
  const color = getIconColor(status);

  return <IconComponent color={color} size={size} />;
}
