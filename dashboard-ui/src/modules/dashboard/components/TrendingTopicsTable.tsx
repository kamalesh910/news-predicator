'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AlertTag from '@/components/elements/AlertTag';
import { useDashboardStore } from '@/store/dashboardStore';
import type { TrendingTopicRow } from '@/services/hydrationService';

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}

function sentimentLabel(score: number | null): string {
  if (score === null) return '—';
  const prefix = score >= 0.5 ? '+' : '';
  return `${prefix}${score.toFixed(2)}`;
}

function sentimentColor(score: number | null): string {
  if (score === null) return 'var(--color-text-secondary)';
  if (score > 0.5) return 'var(--color-alert)';
  return '#34D399';
}

/**
 * TrendingTopicsTable
 *
 * Data priority (highest wins):
 *   1. WebSocket upserts via Zustand store (real-time)
 *   2. Direct fetch from /api/trending-topics on mount
 *   3. Zustand store value (populated by page.tsx hydration)
 *
 * This ensures the table always shows fresh data regardless of
 * whether the store was rehydrated from stale localStorage.
 */
export default function TrendingTopicsTable() {
  const router = useRouter();

  // Store value — updated by WebSocket upserts and page.tsx hydration
  const storeTopics = useDashboardStore((state) => state.trendingTopics);
  const setTrendingTopics = useDashboardStore((state) => state.setTrendingTopics);

  // Local state for direct-fetch result
  const [fetchedTopics, setFetchedTopics] = useState<TrendingTopicRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch directly from the API on mount — bypasses any stale store/localStorage state
  useEffect(() => {
    let cancelled = false;
    fetch('/api/trending-topics?pageSize=50')
      .then((r) => r.json())
      .then((data: TrendingTopicRow[]) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setFetchedTopics(data);
          setTrendingTopics(data); // sync back to store for WebSocket merging
        }
      })
      .catch(() => {
        // silently fall back to store data
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [setTrendingTopics]);

  // Determine which rows to display:
  // fetchedTopics (direct API) > storeTopics (WebSocket updates) > loading skeleton
  const rows: TrendingTopicRow[] = fetchedTopics ?? storeTopics;
  const isLive = rows.length > 0 && !loading;

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-4"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2
            className="text-sm font-semibold uppercase tracking-widest"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Trending Topics
          </h2>
          {isLive && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34D399',
                border: '1px solid rgba(52, 211, 153, 0.4)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#34D399' }}
              />
              LIVE
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push('/live-feed')}
          className="text-xs font-semibold px-3 py-1 rounded border transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--color-accent-primary)',
            color: 'var(--color-accent-primary)',
            background: 'transparent',
          }}
          aria-label="View all trending topics"
        >
          VIEW ALL
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && rows.length === 0 && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 rounded animate-pulse"
              style={{ background: 'var(--color-surface-2)' }}
            />
          ))}
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm border-collapse"
            aria-label="Trending topics table"
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['TOPIC', 'PLATFORM', 'SENTIMENT', 'RISK LEVEL', 'VOLUME', 'TREND'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={`${row.topic_name}-${row.platform}-${idx}`}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <td className="py-2 px-3 font-medium">{row.topic_name}</td>
                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.platform}
                  </td>
                  <td
                    className="py-2 px-3 font-mono font-semibold"
                    style={{ color: sentimentColor(row.avg_bias_score) }}
                  >
                    {sentimentLabel(row.avg_bias_score)}
                  </td>
                  <td className="py-2 px-3">
                    <AlertTag
                      label={row.risk_level.toUpperCase()}
                      variant={row.risk_level}
                    />
                  </td>
                  <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {row.volume > 0 ? formatVolume(row.volume) : '—'}
                  </td>
                  <td
                    className="py-2 px-3 text-center text-base"
                    aria-label={
                      row.trend_direction === '↑' ? 'Increasing'
                      : row.trend_direction === '↓' ? 'Decreasing'
                      : 'Stable'
                    }
                  >
                    {row.trend_direction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
