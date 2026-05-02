'use client';

import { useEffect, useState } from 'react';
import { getConnectionStatus, onStatusChange, ConnectionStatus as WsStatus } from '@/lib/websocket';

/**
 * Displays the current WebSocket connection status with a colored indicator dot.
 * - Green: connected
 * - Yellow: reconnecting
 * - Red: disconnected
 */
export default function ConnectionStatus() {
  const [status, setStatus] = useState<WsStatus>(getConnectionStatus());

  useEffect(() => {
    // Sync with current status on mount (may have changed before component mounted)
    setStatus(getConnectionStatus());

    // Subscribe to future status changes
    const unsubscribe = onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  const config: Record<WsStatus, { dotClass: string; label: string }> = {
    connected: {
      dotClass: 'bg-green-500',
      label: 'Connected',
    },
    reconnecting: {
      dotClass: 'bg-yellow-400',
      label: 'Reconnecting…',
    },
    disconnected: {
      dotClass: 'bg-red-500',
      label: 'Disconnected',
    },
  };

  const { dotClass, label } = config[status];

  return (
    <div
      className="flex items-center gap-2 text-sm font-medium"
      role="status"
      aria-live="polite"
      aria-label={`WebSocket status: ${label}`}
    >
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
        aria-hidden="true"
      />
      <span className="text-gray-700">{label}</span>
    </div>
  );
}
