import { Article, BurstEvent, TrendForecast } from '@/types';
import { createApiClient } from './apiClient';
import type { AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Raw API response shapes (snake_case from the API Gateway)
// ---------------------------------------------------------------------------

export interface RawArticle {
  article_id: string;
  source_url: string;
  title: string;
  body: string;
  source_name: string;
  published_at: string;
  schema_version: string;
  ingested_at: string;
  bias_score: number | null;
  bias_label: string | null;
}

export interface RawPrediction {
  type: 'burst_event' | 'trend_forecast';
  id: string;
  topic_name: string;
  created_at: string;
  // burst_event fields
  article_count?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  // trend_forecast fields
  predicted_volume?: number | null;
  confidence_score?: number | null;
  forecast_horizon?: string | null;
}

export interface HydrationResult {
  articles: Article[];
  burstEvents: BurstEvent[];
  forecasts: TrendForecast[];
  trendingTopics: TrendingTopicRow[];
}

/** Shape returned by GET /trending-topics */
export interface TrendingTopicRow {
  topic_name: string;
  platform: string;
  volume: number;
  avg_bias_score: number | null;
  trend_direction: string;
  risk_level: 'critical' | 'elevated' | 'stable';
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapping functions
// ---------------------------------------------------------------------------

/**
 * Maps a raw snake_case API article to the internal camelCase Article type.
 * Defaults for null/absent fields match the WebSocket handler defaults in page.tsx.
 */
export function mapArticle(raw: RawArticle): Article {
  return {
    articleId: raw.article_id ?? '',
    title: raw.title ?? 'Untitled',
    sourceName: raw.source_name ?? 'Unknown',
    publishedAt: raw.published_at ?? new Date().toISOString(),
    biasScore: raw.bias_score,
  };
}

/**
 * Maps a raw snake_case API prediction of type 'burst_event' to BurstEvent.
 * Defaults for null/absent fields match the WebSocket handler defaults in page.tsx.
 */
export function mapBurstEvent(raw: RawPrediction): BurstEvent {
  return {
    eventId: raw.id ?? '',
    topicName: raw.topic_name ?? '',
    articleCount: raw.article_count ?? 0,
    windowStart: raw.window_start ?? '',
    windowEnd: raw.window_end ?? '',
    detectionTimestamp: raw.created_at ?? new Date().toISOString(),
  };
}

/**
 * Maps a raw snake_case API prediction of type 'trend_forecast' to TrendForecast.
 * Defaults for null/absent fields match the WebSocket handler defaults in page.tsx.
 */
export function mapTrendForecast(raw: RawPrediction): TrendForecast {
  return {
    forecastId: raw.id ?? '',
    topicName: raw.topic_name ?? '',
    predictedVolume: raw.predicted_volume ?? 0,
    confidenceScore: raw.confidence_score ?? 0,
    forecastHorizon: raw.forecast_horizon ?? '',
  };
}

// ---------------------------------------------------------------------------
// hydrateAll
// ---------------------------------------------------------------------------

/**
 * Fetches the 50 most recent articles and predictions from the API Gateway,
 * maps them to internal types, and returns a HydrationResult.
 *
 * Both Axios calls run in parallel via Promise.allSettled. Each uses the
 * injected `client` Axios instance (which has a 5-second timeout configured).
 * Errors are caught and logged; a failed request contributes an empty array
 * for its data type.
 *
 * @param signal - Optional AbortSignal for external cancellation.
 * @param client - Axios instance for dependency injection (defaults to a fresh client).
 */
export async function hydrateAll(
  signal?: AbortSignal,
  client: AxiosInstance = createApiClient(
    typeof window !== 'undefined'
      ? '/api'
      : (process.env.API_GATEWAY_URL ?? 'http://localhost:4000'),
  ),
): Promise<HydrationResult> {
  // Use the same-origin /api proxy (configured in next.config.js rewrites).
  // This avoids NEXT_PUBLIC_* bake-time issues in Docker — the browser always
  // calls its own origin and Next.js proxies to the API Gateway server-side.
  // Falls back to the direct URL for local dev without the proxy.
  const baseUrl =
    typeof window !== 'undefined'
      ? '/api'
      : (process.env.API_GATEWAY_URL ?? 'http://localhost:4000');

  async function axiosGet<T>(path: string): Promise<T[]> {
    try {
      const response = await client.get<T[]>(`${baseUrl}${path}`, { signal });
      return response.data;
    } catch (err: unknown) {
      if (
        err !== null &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name: string }).name === 'CanceledError'
      ) {
        console.error(`[hydrateAll] Request aborted for ${baseUrl}${path}`);
      } else {
        console.error(`[hydrateAll] Request error for ${baseUrl}${path}:`, err);
      }
      return [];
    }
  }

  const [articlesResult, predictionsResult, trendingResult] = await Promise.allSettled([
    axiosGet<RawArticle>('/articles?pageSize=50'),
    axiosGet<RawPrediction>('/predictions?pageSize=50'),
    axiosGet<TrendingTopicRow>('/trending-topics?pageSize=50'),
  ]);

  const rawArticles: RawArticle[] =
    articlesResult.status === 'fulfilled' ? articlesResult.value : [];

  const rawPredictions: RawPrediction[] =
    predictionsResult.status === 'fulfilled' ? predictionsResult.value : [];

  const trendingTopics: TrendingTopicRow[] =
    trendingResult.status === 'fulfilled' ? trendingResult.value : [];

  const articles = rawArticles.map(mapArticle);

  const burstEvents = rawPredictions
    .filter((p) => p.type === 'burst_event')
    .map(mapBurstEvent);

  const forecasts = rawPredictions
    .filter((p) => p.type === 'trend_forecast')
    .map(mapTrendForecast);

  return { articles, burstEvents, forecasts, trendingTopics };
}
