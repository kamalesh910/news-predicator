import { Article, BurstEvent, TrendForecast } from '@/types';

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

const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetches the 50 most recent articles and predictions from the API Gateway,
 * maps them to internal types, and returns a HydrationResult.
 *
 * Both fetch calls run in parallel via Promise.allSettled. Each uses an
 * AbortController with a 5-second timeout. Errors are caught and logged;
 * a failed fetch contributes an empty array for its data type.
 *
 * @param signal - Optional AbortSignal for external cancellation.
 */
export async function hydrateAll(signal?: AbortSignal): Promise<HydrationResult> {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:4000';

  // Helper: fetch with a per-request 5-second timeout AbortController.
  // If the caller also passes an external signal, aborting it will abort the
  // internal controller as well.
  async function fetchWithTimeout<T>(url: string): Promise<T[]> {
    const controller = new AbortController();

    // Wire external cancellation into the internal controller.
    const onExternalAbort = () => controller.abort();
    if (signal) {
      if (signal.aborted) {
        // Already aborted before we even start.
        controller.abort();
      } else {
        signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(
          `[hydrateAll] Non-2xx response from ${url}: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      return (await response.json()) as T[];
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[hydrateAll] Fetch aborted for ${url}`);
      } else {
        console.error(`[hydrateAll] Fetch error for ${url}:`, err);
      }

      return [];
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  const [articlesResult, predictionsResult] = await Promise.allSettled([
    fetchWithTimeout<RawArticle>(`${baseUrl}/articles?pageSize=50`),
    fetchWithTimeout<RawPrediction>(`${baseUrl}/predictions?pageSize=50`),
  ]);

  const rawArticles: RawArticle[] =
    articlesResult.status === 'fulfilled' ? articlesResult.value : [];

  const rawPredictions: RawPrediction[] =
    predictionsResult.status === 'fulfilled' ? predictionsResult.value : [];

  const articles = rawArticles.map(mapArticle);

  const burstEvents = rawPredictions
    .filter((p) => p.type === 'burst_event')
    .map(mapBurstEvent);

  const forecasts = rawPredictions
    .filter((p) => p.type === 'trend_forecast')
    .map(mapTrendForecast);

  return { articles, burstEvents, forecasts };
}
