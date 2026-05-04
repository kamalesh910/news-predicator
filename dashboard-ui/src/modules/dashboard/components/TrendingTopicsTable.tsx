'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AlertTag from '@/components/elements/AlertTag';
import { useDashboardStore } from '@/store/dashboardStore';
import type { Article } from '@/modules/dashboard/types';

type RiskLevel = 'critical' | 'elevated' | 'stable';

interface TopicRow {
  topic: string;
  platform: string;
  sentiment: string;
  riskLevel: RiskLevel;
  volume: string;
  trend: string;
}

const SEED_ROWS: TopicRow[] = [
  {
    topic: 'Energy Policy Reform',
    platform: 'Twitter',
    sentiment: '+0.72',
    riskLevel: 'elevated' as const,
    volume: '12.4K',
    trend: '↑',
  },
  {
    topic: 'Regional Conflict Escalation',
    platform: 'Reddit',
    sentiment: '-0.45',
    riskLevel: 'critical' as const,
    volume: '8.9K',
    trend: '↑',
  },
  {
    topic: 'Tech Layoff Rumors',
    platform: 'LinkedIn',
    sentiment: '-0.21',
    riskLevel: 'stable' as const,
    volume: '5.2K',
    trend: '→',
  },
];

/** Map an Article from the dashboard store to a TopicRow for display. */
function articleToRow(article: Article): TopicRow {
  const bias = article.biasScore ?? 0;
  const riskLevel: RiskLevel =
    bias > 0.6 ? 'critical' : bias > 0.3 ? 'elevated' : 'stable';
  const sentiment = bias >= 0 ? `+${bias.toFixed(2)}` : bias.toFixed(2);

  return {
    topic: article.title,
    platform: article.sourceName,
    sentiment,
    riskLevel,
    volume: '—',
    trend: '→',
  };
}

/**
 * TrendingTopicsTable — displays a live-updating table of trending topics.
 * Seed rows are shown by default; new articles from the dashboard store are
 * prepended at the top, keeping a maximum of 20 rows total.
 */
export default function TrendingTopicsTable() {
  const router = useRouter();
  const articles = useDashboardStore((state) => state.articles);

  const rows = useMemo<TopicRow[]>(() => {
    const liveRows = articles.map(articleToRow);
    const combined = [...liveRows, ...SEED_ROWS];
    return combined.slice(0, 20);
  }, [articles]);

  const sentimentColor = (sentiment: string): string => {
    if (sentiment.startsWith('+')) return '#34D399';
    if (sentiment.startsWith('-')) return 'var(--color-alert)';
    return 'var(--color-text-secondary)';
  };

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-4"
      style={{ background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Trending Topics
        </h2>
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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" aria-label="Trending topics table">
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
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={`${row.topic}-${idx}`}
                style={{ borderBottom: '1px solid var(--color-border)' }}
                className="hover:bg-[var(--color-surface-2)] transition-colors"
              >
                <td className="py-2 px-3 font-medium">{row.topic}</td>
                <td
                  className="py-2 px-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {row.platform}
                </td>
                <td
                  className="py-2 px-3 font-mono font-semibold"
                  style={{ color: sentimentColor(row.sentiment) }}
                >
                  {row.sentiment}
                </td>
                <td className="py-2 px-3">
                  <AlertTag
                    label={row.riskLevel.toUpperCase()}
                    variant={row.riskLevel}
                  />
                </td>
                <td
                  className="py-2 px-3"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {row.volume}
                </td>
                <td className="py-2 px-3 text-center">{row.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
