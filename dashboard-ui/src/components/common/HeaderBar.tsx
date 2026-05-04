'use client';

import React from 'react';
import { useGlobalStore } from '@/store/globalStore';
import type { ConnectionStatus } from '@/modules/dashboard/types';

const SIDEBAR_WIDTH = 64;

function wsStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return '#34D399';
    case 'reconnecting':
      return '#FBBF24';
    case 'disconnected':
    default:
      return 'var(--color-alert)';
  }
}

function wsStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting';
    case 'disconnected':
    default:
      return 'Disconnected';
  }
}

export default function HeaderBar() {
  const wsStatus = useGlobalStore((s) => s.wsStatus);
  const setSearchQuery = useGlobalStore((s) => s.setSearchQuery);

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: `${SIDEBAR_WIDTH}px`,
        right: 0,
        height: '56px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '20px',
        paddingRight: '20px',
        gap: '16px',
        zIndex: 40,
      }}
      role="banner"
    >
      {/* Logo / brand text */}
      <div
        style={{
          flexShrink: 0,
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap',
        }}
      >
        SENTINEL | RISK INTELLIGENCE
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Global search */}
      <label htmlFor="global-search" style={{ display: 'flex', alignItems: 'center' }}>
        <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          Search
        </span>
        <input
          id="global-search"
          type="search"
          placeholder="Search…"
          aria-label="Global search"
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '220px',
            height: '32px',
            backgroundColor: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
            paddingLeft: '10px',
            paddingRight: '10px',
            outline: 'none',
          }}
        />
      </label>

      {/* WebSocket status dot */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
        title={`WebSocket: ${wsStatusLabel(wsStatus)}`}
        aria-label={`Connection status: ${wsStatusLabel(wsStatus)}`}
      >
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: wsStatusColor(wsStatus),
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
        <span
          style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          {wsStatusLabel(wsStatus)}
        </span>
      </div>

      {/* Notification bell */}
      <button
        type="button"
        aria-label="Notifications"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '4px',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2a6 6 0 00-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 00-6-6z"
            fill="currentColor"
          />
          <rect x="8.5" y="16" width="3" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      {/* User profile */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '1px',
        }}
        aria-label="User profile"
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          Analyst Prime
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: 'var(--color-accent-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          ADMIN PRIVILEGE
        </span>
      </div>
    </header>
  );
}
