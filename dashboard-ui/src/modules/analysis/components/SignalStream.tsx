'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/store/analysisStore';
import { getSocket } from '@/lib/websocket';
import { SignalEvent } from '@/modules/analysis/types';

/**
 * Seed events shown when no live signals have been received yet.
 */
const SEED_SIGNALS: SignalEvent[] = [
  {
    id: '1',
    type: 'NARRATIVE SHIFT',
    timestamp: '14:32:01',
    description: 'Significant shift in climate policy discourse detected',
  },
  {
    id: '2',
    type: 'VOLATILITY ALERT',
    timestamp: '13:15:44',
    description: 'High volatility in energy sector narratives',
  },
  {
    id: '3',
    type: 'SYSTEM UPDATE',
    timestamp: '12:00:00',
    description: 'Data pipeline refresh completed',
  },
];

/** Returns the badge color for a given signal event type. */
function getBadgeStyle(type: SignalEvent['type']): React.CSSProperties {
  switch (type) {
    case 'NARRATIVE SHIFT':
      return {
        background: 'rgba(43, 127, 255, 0.15)',
        color: 'var(--color-accent-primary)',
        border: '1px solid rgba(43, 127, 255, 0.4)',
      };
    case 'VOLATILITY ALERT':
      return {
        background: 'rgba(231, 129, 112, 0.15)',
        color: 'var(--color-alert)',
        border: '1px solid rgba(231, 129, 112, 0.4)',
      };
    case 'SYSTEM UPDATE':
    default:
      return {
        background: 'rgba(139, 149, 169, 0.15)',
        color: 'var(--color-text-secondary)',
        border: '1px solid rgba(139, 149, 169, 0.3)',
      };
  }
}

/**
 * SignalStream — subscribes to WebSocket `signal_event` messages and renders
 * a live timeline of signal events. Falls back to seed events when the store
 * is empty.
 */
export default function SignalStream() {
  const signals = useAnalysisStore((state) => state.signals);
  const prependSignal = useAnalysisStore((state) => state.prependSignal);

  useEffect(() => {
    const socket = getSocket();

    function handleSignalEvent(event: SignalEvent) {
      prependSignal(event);
    }

    socket.on('signal_event', handleSignalEvent);

    return () => {
      socket.off('signal_event', handleSignalEvent);
    };
  }, [prependSignal]);

  const displaySignals = signals.length > 0 ? signals : SEED_SIGNALS;

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-4"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
    >
      {/* Panel title */}
      <h2
        className="text-sm font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Signal Stream
      </h2>

      {/* Timeline */}
      <ol className="flex flex-col gap-3" aria-label="Signal event timeline">
        {displaySignals.map((signal) => (
          <li
            key={signal.id}
            className="flex flex-col gap-1.5 rounded-lg p-3"
            style={{
              background: 'var(--color-surface-2)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Type badge + timestamp row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide"
                style={getBadgeStyle(signal.type)}
              >
                {signal.type}
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {signal.timestamp}
              </span>
            </div>

            {/* Description */}
            <p
              className="text-sm leading-snug"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {signal.description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
