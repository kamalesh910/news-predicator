'use client';

import { useMemo } from 'react';
import { Article } from '@/types';

interface HeatmapProps {
  articles: Article[];
  onRegionClick: (region: string) => void;
}

/**
 * Returns a Tailwind background class based on a bias score.
 * - null / low  (< 0.33): green
 * - medium (0.33–0.66):   yellow
 * - high   (> 0.66):      red
 */
function biasColorClass(score: number | null): string {
  if (score === null) return 'bg-gray-100 border-gray-200';
  if (score < 0.33) return 'bg-green-100 border-green-300';
  if (score < 0.67) return 'bg-yellow-100 border-yellow-300';
  return 'bg-red-100 border-red-300';
}

function biasLabel(score: number | null): string {
  if (score === null) return 'N/A';
  return score.toFixed(2);
}

/**
 * Renders a real-time heatmap of bias-scored articles grouped by source (region).
 * Each article cell shows title, source, publication timestamp, and bias score.
 * Clicking a region header calls `onRegionClick` with the source name.
 */
export default function Heatmap({ articles, onRegionClick }: HeatmapProps) {
  // Group articles by sourceName
  const regions = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const article of articles) {
      const group = map.get(article.sourceName) ?? [];
      group.push(article);
      map.set(article.sourceName, group);
    }
    return map;
  }, [articles]);

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-sm text-gray-500">
        No articles to display
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Bias heatmap">
      {Array.from(regions.entries()).map(([sourceName, regionArticles]) => (
        <section key={sourceName}>
          {/* Region header — clicking filters the article list */}
          <button
            type="button"
            onClick={() => onRegionClick(sourceName)}
            className="mb-2 flex items-center gap-2 rounded px-2 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Filter by region: ${sourceName}`}
          >
            <span>{sourceName}</span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
              {regionArticles.length}
            </span>
          </button>

          {/* Article cells */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {regionArticles.map((article) => (
              <div
                key={article.articleId}
                className={`rounded-lg border p-3 ${biasColorClass(article.biasScore)}`}
                role="article"
                aria-label={`Article: ${article.title}`}
              >
                <p className="line-clamp-2 text-sm font-medium text-gray-900">
                  {article.title}
                </p>
                <p className="mt-1 text-xs text-gray-600">{article.sourceName}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  <time dateTime={article.publishedAt}>
                    {new Date(article.publishedAt).toLocaleString()}
                  </time>
                </p>
                <p className="mt-1 text-xs font-semibold text-gray-700">
                  Bias score:{' '}
                  <span aria-label={`Bias score: ${biasLabel(article.biasScore)}*100`}>
                    {biasLabel(article.biasScore)}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
