'use client';

import { useMemo } from 'react';
import { Article } from '@/types';

interface ArticleFilterPanelProps {
  articles: Article[];
  selectedRegion: string | null;
}

/**
 * Renders a filtered list of articles for the selected heatmap region (sourceName).
 * Shows a prompt message when no region is selected.
 */
export default function ArticleFilterPanel({
  articles,
  selectedRegion,
}: ArticleFilterPanelProps) {
  const filtered = useMemo(() => {
    if (selectedRegion === null) return [];
    return articles.filter((a) => a.sourceName === selectedRegion);
  }, [articles, selectedRegion]);

  if (selectedRegion === null) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-sm text-gray-500"
        role="status"
      >
        Select a region to view its articles
      </div>
    );
  }

  return (
    <section
      aria-label={`Articles from ${selectedRegion}`}
      className="space-y-3"
    >
      <h2 className="text-sm font-semibold text-gray-700">
        {selectedRegion}{' '}
        <span className="font-normal text-gray-500">
          ({filtered.length} article{filtered.length !== 1 ? 's' : ''})
        </span>
      </h2>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-500">No articles found for this region.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {filtered.map((article) => (
            <li key={article.articleId} className="px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{article.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>{article.sourceName}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={article.publishedAt}>
                  {new Date(article.publishedAt).toLocaleString()}
                </time>
                {article.biasScore !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Bias:{' '}
                      <span
                        className={
                          article.biasScore < 0.33
                            ? 'text-green-600'
                            : article.biasScore < 0.67
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }
                      >
                        {article.biasScore.toFixed(2)}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
