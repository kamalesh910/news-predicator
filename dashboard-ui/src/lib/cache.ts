import type { Article, BurstEvent, TrendForecast } from '@/types';

// Storage key and TTL
export const CACHE_KEY = 'ainews_dashboard_cache';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Per-type size limits
export const MAX_ARTICLES = 50;
export const MAX_BURST_EVENTS = 20;
export const MAX_FORECASTS = 50;

/**
 * Shape of the dashboard snapshot stored in localStorage.
 * version: 1 is a literal type used for schema migration guards.
 */
export interface DashboardCache {
  version: 1;
  savedAt: string; // ISO 8601 timestamp
  articles: Article[]; // max MAX_ARTICLES
  burstEvents: BurstEvent[]; // max MAX_BURST_EVENTS
  forecasts: TrendForecast[]; // max MAX_FORECASTS
}

/**
 * Read the dashboard cache from localStorage.
 * Returns null if the cache is absent, malformed, or expired.
 */
export function readCache(): DashboardCache | null {
  // Step 1: retrieve raw value — absent means no cache
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw === null) {
    return null;
  }

  // Step 2: parse JSON — corrupt data is cleared and discarded
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearCache();
    return null;
  }

  // Step 3: validate schema version and savedAt timestamp
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>).version !== 1 ||
    typeof (parsed as Record<string, unknown>).savedAt !== 'string' ||
    isNaN(new Date((parsed as Record<string, unknown>).savedAt as string).getTime())
  ) {
    clearCache();
    return null;
  }

  // Step 4: TTL check — discard entries older than CACHE_TTL_MS
  const { savedAt } = parsed as { savedAt: string };
  if (Date.now() - new Date(savedAt).getTime() > CACHE_TTL_MS) {
    clearCache();
    return null;
  }

  // Step 5: return the valid, unexpired cache
  return parsed as DashboardCache;
}

/**
 * Write the dashboard state to localStorage as a DashboardCache snapshot.
 * Arrays are sliced to their respective size limits before serialization.
 * Silently ignores QuotaExceededError.
 */
export function writeCache(
  data: Omit<DashboardCache, 'version' | 'savedAt'>,
): void {
  const cache: DashboardCache = {
    version: 1,
    savedAt: new Date().toISOString(),
    articles: data.articles.slice(0, MAX_ARTICLES),
    burstEvents: data.burstEvents.slice(0, MAX_BURST_EVENTS),
    forecasts: data.forecasts.slice(0, MAX_FORECASTS),
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Silently ignore QuotaExceededError and other storage errors
  }
}

/**
 * Remove the dashboard cache entry from localStorage.
 */
export function clearCache(): void {
  localStorage.removeItem(CACHE_KEY);
}
