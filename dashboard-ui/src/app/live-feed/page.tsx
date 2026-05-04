'use client';

import { useEffect, useState } from 'react';
import AlertTag from '@/components/elements/AlertTag';
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

export default function LiveFeedPage() {
  const [topics, setTopics] = useState<TrendingTopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchTopics = () => {
    fetch('/api/trending-topics?pageSize=100')
      .then((r) => r.json())
      .then((data: TrendingTopicRow[]) => {
        if (Array.isArray(data)) {
          setTopics(data);
          setLastUpdated(new Date().toLocaleTimeString());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Fetch on mount and auto-refresh every 30 seconds
  useEffect(() => {
    fetchTopics();
    const interval = setInterval(fetchTopics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-xl font-bold uppercase tracking-widest"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Live Feed
          </h1>
          {lastUpdated && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Last updated: {lastUpdated} · auto-refreshes every 30s
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={fetchTopics}
          className="text-xs font-semibold px-3 py-1.5 rounded border transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--color-accent-primary)',
            color: 'var(--color-accent-primary)',
            background: 'transparent',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-lg p-4"
        style={{ background: 'var(--color-surface)' }}
      >
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-10 rounded animate-pulse"
                style={{ background: 'var(--color-surface-2)' }}
              />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
            No trending topics yet. Inject articles into the pipeline to see data here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" aria-label="All trending topics">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['TOPIC', 'PLATFORM', 'SENTIMENT', 'RISK LEVEL', 'VOLUME', 'TREND', 'UPDATED'].map(
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
                {topics.map((row, idx) => (
                  <tr
                    key={`${row.topic_name}-${row.platform}-${idx}`}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {row.topic_name}
                    </td>
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
                      <AlertTag label={row.risk_level.toUpperCase()} variant={row.risk_level} />
                    </td>
                    <td className="py-2 px-3" style={{ color: 'var(--color-text-secondary)' }}>
                      {row.volume > 0 ? formatVolume(row.volume) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center text-base">
                      {row.trend_direction}
                    </td>
                    <td className="py-2 px-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {new Date(row.updated_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
