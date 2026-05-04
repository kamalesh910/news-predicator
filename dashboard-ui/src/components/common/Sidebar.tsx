'use client';

import Link from 'next/link';
import React from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'DASHBOARD',
    href: '/',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="2" width="7" height="7" rx="1" fill="currentColor" />
        <rect x="11" y="2" width="7" height="7" rx="1" fill="currentColor" />
        <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" />
        <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'LIVE FEED',
    href: '/live-feed',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="14" width="10" height="2" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'ALERTS',
    href: '/alerts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d="M10 2C10 2 5 6 5 11a5 5 0 0010 0C15 6 10 2 10 2z"
          fill="currentColor"
        />
        <rect x="8.5" y="16" width="3" height="2" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: 'TOPIC ANALYSIS',
    href: '/analysis',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="3" fill="currentColor" />
        <path
          d="M10 2v3M10 15v3M2 10h3M15 10h3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: 'GEO INTELLIGENCE',
    href: '/geo',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
        <ellipse cx="10" cy="10" rx="4" ry="8" stroke="currentColor" strokeWidth="1.5" />
        <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: 'PREDICTIONS',
    href: '/predictions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <polyline
          points="2,15 7,9 11,12 18,4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <polyline
          points="14,4 18,4 18,8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    label: 'REPORTS',
    href: '/reports',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="4" y="2" width="12" height="16" rx="1" stroke="currentColor" strokeWidth="2" />
        <line x1="7" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="13" x2="10" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'SETTINGS',
    href: '/settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

interface SidebarProps {
  activePath: string;
}

export default function Sidebar({ activePath }: SidebarProps) {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        height: '100vh',
        width: '64px',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '0',
        zIndex: 50,
        borderRight: '1px solid var(--color-border)',
      }}
      aria-label="Main navigation"
    >
      {/* Brand header */}
      <div
        style={{
          width: '100%',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '8px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--color-accent-primary)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            userSelect: 'none',
          }}
        >
          SENTINEL AI
        </span>
      </div>

      {/* Navigation items */}
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: '8px 0',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        {navItems.map((item) => {
          const isActive = activePath === item.href;
          return (
            <li key={item.href} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <Link
                href={item.href}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '52px',
                  height: '52px',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'var(--color-accent-primary)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                  textDecoration: 'none',
                  gap: '3px',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.currentTarget as HTMLAnchorElement).click();
                  }
                }}
              >
                {item.icon}
                <span
                  style={{
                    fontSize: '6px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: '48px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
