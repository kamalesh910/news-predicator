'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/websocket';
import { readCache, writeCache } from '@/lib/cache';
import { hydrateAll } from '@/lib/hydration';
import { Article, BurstEvent, TrendForecast } from '@/types';
import ConnectionStatus from '@/components/ConnectionStatus';
import ControversyAlert from '@/components/ControversyAlert';
import Heatmap from '@/components/Heatmap';
import ArticleFilterPanel from '@/components/ArticleFilterPanel';
import TrendPanel from '@/components/TrendPanel';

function mergeUnique<T>(
  existing: T[],
  incoming: T[],
  key: keyof T,
  limit: number,
): T[] {
  const existingKeys = new Set(existing.map((item) => item[key]));
  const newItems = incoming.filter((item) => !existingKeys.has(item[key]));
  return [...newItems, ...existing].slice(0, limit);
}

export default function DashboardPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [burstEvents, setBurstEvents] = useState<BurstEvent[]>([]);
  const [forecasts, setForecasts] = useState<TrendForecast[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  // Refs to track latest state values for debounced cache writes
  const articlesRef = useRef<Article[]>([]);
  const burstEventsRef = useRef<BurstEvent[]>([]);
  const forecastsRef = useRef<TrendForecast[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: pre-populate state from cache, then hydrate from API
  useEffect(() => {
    const cache = readCache();
    if (cache !== null) {
      setArticles(cache.articles);
      setBurstEvents(cache.burstEvents);
      setForecasts(cache.forecasts);
    }

    const controller = new AbortController();

    (async () => {
      try {
        const result = await hydrateAll(controller.signal);
        setArticles((prev) => mergeUnique(prev, result.articles, 'articleId', 200));
        setBurstEvents((prev) => mergeUnique(prev, result.burstEvents, 'eventId', 20));
        setForecasts((prev) => mergeUnique(prev, result.forecasts, 'forecastId', 50));
        writeCache({
          articles: mergeUnique(cache?.articles ?? [], result.articles, 'articleId', 50),
          burstEvents: mergeUnique(cache?.burstEvents ?? [], result.burstEvents, 'eventId', 20),
          forecasts: mergeUnique(cache?.forecasts ?? [], result.forecasts, 'forecastId', 50),
        });
      } catch {
        // hydrateAll never throws, but catch just in case
      } finally {
        setIsHydrating(false);
      }
    })();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const socket = getSocket();

    function scheduleCacheWrite() {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        writeCache({
          articles: articlesRef.current.slice(0, 50),
          burstEvents: burstEventsRef.current.slice(0, 20),
          forecasts: forecastsRef.current.slice(0, 50),
        });
      }, 5000);
    }

    function handleMessage(data: unknown) {
      if (typeof data !== 'object' || data === null) return;

      const msg = data as Record<string, unknown>;

      if (msg.type === 'burst_event') {
        const event: BurstEvent = {
          eventId: String(msg.eventId ?? ''),
          topicName: String(msg.topicName ?? ''),
          articleCount: Number(msg.articleCount ?? 0),
          windowStart: String(msg.windowStart ?? ''),
          windowEnd: String(msg.windowEnd ?? ''),
          detectionTimestamp: String(msg.detectionTimestamp ?? new Date().toISOString()),
        };
        setBurstEvents((prev) => {
          const next = mergeUnique(prev, [event], 'eventId', 20);
          burstEventsRef.current = next;
          scheduleCacheWrite();
          return next;
        });

      } else if (msg.type === 'trend_forecast') {
        const forecast: TrendForecast = {
          forecastId: String(msg.forecastId ?? ''),
          topicName: String(msg.topicName ?? ''),
          predictedVolume: Number(msg.predictedVolume ?? 0),
          confidenceScore: Number(msg.confidenceScore ?? 0),
          forecastHorizon: String(msg.forecastHorizon ?? ''),
        };
        setForecasts((prev) => {
          const next = mergeUnique(prev, [forecast], 'forecastId', 50);
          forecastsRef.current = next;
          scheduleCacheWrite();
          return next;
        });

      } else if (msg.type === 'article' || msg.articleId) {
        // Analyzed article from analyzed-news topic
        const article: Article = {
          articleId: String(msg.articleId ?? Math.random()),
          title: String(msg.title ?? 'Untitled'),
          sourceName: String(msg.sourceName ?? 'Unknown'),
          publishedAt: String(msg.publishedAt ?? new Date().toISOString()),
          biasScore: msg.biasScore != null ? Number(msg.biasScore) : null,
        };
        setArticles((prev) => {
          const next = mergeUnique(prev, [article], 'articleId', 200);
          articlesRef.current = next;
          scheduleCacheWrite();
          return next;
        });
      }
    }

    socket.on('message', handleMessage);
    return () => {
      socket.off('message', handleMessage);
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="text-lg font-bold tracking-tight text-gray-900">
            AI News Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">
              {articles.length} articles · {burstEvents.length} alerts
            </span>
            {isHydrating && (
              <span className="text-xs text-gray-400 animate-pulse">Refreshing…</span>
            )}
            <ConnectionStatus />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {burstEvents.length > 0 && (
          <section aria-label="Controversy alerts">
            <ControversyAlert events={burstEvents} />
          </section>
        )}

        <section aria-label="Bias heatmap">
          <h2 className="mb-3 text-base font-semibold text-gray-800">
            Real-Time Bias Heatmap
            {articles.length === 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                — waiting for articles...
              </span>
            )}
          </h2>
          <Heatmap
            articles={articles}
            onRegionClick={(region) => setSelectedRegion(region)}
          />
        </section>

        <section aria-label="Filtered articles">
          <h2 className="mb-3 text-base font-semibold text-gray-800">Articles</h2>
          <ArticleFilterPanel articles={articles} selectedRegion={selectedRegion} />
        </section>

        <section aria-label="Trend forecasts">
          <TrendPanel forecasts={forecasts} />
        </section>

      </main>
    </div>
  );
}
