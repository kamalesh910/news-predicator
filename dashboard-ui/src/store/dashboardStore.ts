import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Article, BurstEvent, TrendForecast } from '@/modules/dashboard/types';
import type { TrendingTopicRow } from '@/services/hydrationService';

interface DashboardState {
  articles: Article[];
  burstEvents: BurstEvent[];
  forecasts: TrendForecast[];
  trendingTopics: TrendingTopicRow[];
  selectedRegion: string | null;
}

interface DashboardActions {
  setArticles: (articles: Article[]) => void;
  setBurstEvents: (events: BurstEvent[]) => void;
  setForecasts: (forecasts: TrendForecast[]) => void;
  setTrendingTopics: (topics: TrendingTopicRow[]) => void;
  setSelectedRegion: (region: string | null) => void;
  mergeArticle: (article: Article) => void;
  mergeBurstEvent: (event: BurstEvent) => void;
  mergeForecast: (forecast: TrendForecast) => void;
  /** Upsert a trending topic row by topic_name+platform key. */
  upsertTrendingTopic: (topic: TrendingTopicRow) => void;
}

type DashboardStore = DashboardState & DashboardActions;

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      articles: [],
      burstEvents: [],
      forecasts: [],
      trendingTopics: [],
      selectedRegion: null,

      setArticles: (articles) => set({ articles }),
      setBurstEvents: (events) => set({ burstEvents: events }),
      setForecasts: (forecasts) => set({ forecasts }),
      setTrendingTopics: (topics) => set({ trendingTopics: topics }),
      setSelectedRegion: (region) => set({ selectedRegion: region }),

      mergeArticle: (article) =>
        set((state) => {
          const exists = state.articles.some(
            (a) => a.articleId === article.articleId
          );
          if (exists) return state;
          const updated = [article, ...state.articles];
          return { articles: updated.slice(0, 200) };
        }),

      mergeBurstEvent: (event) =>
        set((state) => {
          const exists = state.burstEvents.some(
            (e) => e.eventId === event.eventId
          );
          if (exists) return state;
          const updated = [event, ...state.burstEvents];
          return { burstEvents: updated.slice(0, 20) };
        }),

      mergeForecast: (forecast) =>
        set((state) => {
          const exists = state.forecasts.some(
            (f) => f.forecastId === forecast.forecastId
          );
          if (exists) return state;
          const updated = [forecast, ...state.forecasts];
          return { forecasts: updated.slice(0, 50) };
        }),

      upsertTrendingTopic: (topic) =>
        set((state) => {
          const idx = state.trendingTopics.findIndex(
            (t) => t.topic_name === topic.topic_name && t.platform === topic.platform
          );
          let updated: TrendingTopicRow[];
          if (idx >= 0) {
            updated = [...state.trendingTopics];
            updated[idx] = topic;
          } else {
            updated = [topic, ...state.trendingTopics];
          }
          return { trendingTopics: updated.slice(0, 100) };
        }),
    }),
    {
      name: 'sentinel-dashboard',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // Never restore trendingTopics from localStorage — always fetch fresh from API
      partialize: (state) => ({
        articles: state.articles,
        burstEvents: state.burstEvents,
        forecasts: state.forecasts,
        selectedRegion: state.selectedRegion,
        // trendingTopics intentionally excluded — always loaded from /trending-topics
      }),
    }
  )
);
