/**
 * Connection Status Icon Component
 * Displays phone (local) or computer (remote) icon with color-coded status
 */

import React from 'react';
import { Smartphone, Monitor } from 'lucide-react-native';
import type { ConnectionStatus } from '../types/RemoteConnection';

interface ConnectionStatusIconProps {
  status: ConnectionStatus;
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
 * Get icon component based on connection status
 * Phone icon for local, Computer icon for remote
 */
function getIconComponent(status: ConnectionStatus): typeof Smartphone | typeof Monitor {
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

export function ConnectionStatusIcon({ status, size = 20 }: ConnectionStatusIconProps) {
  const IconComponent = getIconComponent(status);
  const color = getIconColor(status);

  return <IconComponent color={color} size={size} />;
}
