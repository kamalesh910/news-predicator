'use client';

import { useEffect, useRef } from 'react';
import { writeCache } from '@/lib/cache';
import { hydrateAll } from '@/services/hydrationService';
import { useDashboardStore } from '@/store/dashboardStore';
import DashboardView from '@/modules/dashboard/DashboardView';

export default function DashboardPage() {
  const {
    setArticles,
    setBurstEvents,
    setForecasts,
    setTrendingTopics,
  } = useDashboardStore();

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: trigger Zustand persist rehydration from localStorage
  useEffect(() => {
    useDashboardStore.persist.rehydrate();
  }, []);

  // Set up a Zustand store subscription that writes to cache with 5-second debounce
  useEffect(() => {
    const unsubscribe = useDashboardStore.subscribe((state) => {
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        writeCache({
          articles: state.articles.slice(0, 50),
          burstEvents: state.burstEvents.slice(0, 20),
          forecasts: state.forecasts.slice(0, 50),
        });
      }, 5000);
    });
    return () => {
      unsubscribe();
      if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // On mount: hydrate from API and merge into store
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const result = await hydrateAll(controller.signal);
        setArticles(result.articles);
        setBurstEvents(result.burstEvents);
        setForecasts(result.forecasts);
        setTrendingTopics(result.trendingTopics);
      } catch {
        // hydrateAll never throws, but catch just in case
      }
    })();

    return () => controller.abort();
  }, [setArticles, setBurstEvents, setForecasts, setTrendingTopics]);

  return <DashboardView />;
}
