import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Article, BurstEvent, TrendForecast } from '@/modules/dashboard/types';

interface DashboardState {
  articles: Article[];
  burstEvents: BurstEvent[];
  forecasts: TrendForecast[];
  selectedRegion: string | null;
}

interface DashboardActions {
  setArticles: (articles: Article[]) => void;
  setBurstEvents: (events: BurstEvent[]) => void;
  setForecasts: (forecasts: TrendForecast[]) => void;
  setSelectedRegion: (region: string | null) => void;
  mergeArticle: (article: Article) => void;
  mergeBurstEvent: (event: BurstEvent) => void;
  mergeForecast: (forecast: TrendForecast) => void;
}

type DashboardStore = DashboardState & DashboardActions;

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      articles: [],
      burstEvents: [],
      forecasts: [],
      selectedRegion: null,

      setArticles: (articles) => set({ articles }),
      setBurstEvents: (events) => set({ burstEvents: events }),
      setForecasts: (forecasts) => set({ forecasts }),
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
    }),
    {
      name: 'sentinel-dashboard',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
);
