'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/common/Sidebar';
import HeaderBar from '@/components/common/HeaderBar';
import { onStatusChange } from '@/lib/websocket';
import { useGlobalStore } from '@/store/globalStore';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const setWsStatus = useGlobalStore((s) => s.setWsStatus);

  useEffect(() => {
    // Rehydrate persisted global store from localStorage
    useGlobalStore.persist.rehydrate();

    // Subscribe to WebSocket status changes
    const unsubscribe = onStatusChange((status) => {
      setWsStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, [setWsStatus]);

  return (
    <html lang="en">
      <body
        className={`${inter.variable} font-sans antialiased`}
        style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
      >
        <Sidebar activePath={pathname} />
        <HeaderBar />
        <main
          style={{
            marginLeft: '64px',
            marginTop: '56px',
            padding: '24px',
            minHeight: '100vh',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
