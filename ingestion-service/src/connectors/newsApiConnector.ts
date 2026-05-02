/**
 * NewsApiConnector — HTTP polling connector for news APIs.
 *
 * Features:
 *   - Configurable poll interval and API endpoint
 *   - Exponential-backoff reconnect on connection loss
 *   - Structured error logging on disconnect
 *   - Emits articles via an onArticle callback
 *
 * Satisfies Requirements 1.2, 1.3, 1.6
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: 'ingestion-service', connector: 'NewsApiConnector' },
  transports: [new transports.Console()],
});

export interface NewsApiConnectorConfig {
  /** Full URL of the news API endpoint to poll */
  apiUrl: string;
  /** Optional API key sent as the `X-Api-Key` header */
  apiKey?: string;
  /** How often to poll the endpoint, in milliseconds (default: 60 000) */
  pollIntervalMs?: number;
  /** Initial reconnect delay in milliseconds (default: 1 000) */
  initialRetryDelayMs?: number;
  /** Maximum reconnect delay in milliseconds (default: 60 000) */
  maxRetryDelayMs?: number;
  /** Backoff multiplier applied on each failed attempt (default: 2) */
  retryBackoffMultiplier?: number;
}

export type ArticleCallback = (article: unknown) => void;

export class NewsApiConnector {
  private readonly apiUrl: string;
  private readonly pollIntervalMs: number;
  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly retryBackoffMultiplier: number;

  private readonly axiosInstance: AxiosInstance;
  private onArticle: ArticleCallback | null = null;

  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: NewsApiConnectorConfig) {
    this.apiUrl = config.apiUrl;
    this.pollIntervalMs = config.pollIntervalMs ?? 60_000;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? 1_000;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? 60_000;
    this.retryBackoffMultiplier = config.retryBackoffMultiplier ?? 2;

    this.axiosInstance = axios.create({
      headers: config.apiKey ? { 'X-Api-Key': config.apiKey } : {},
      timeout: 10_000,
    });
  }

  /**
   * Registers the callback that will be invoked for each article received.
   */
  onData(callback: ArticleCallback): void {
    this.onArticle = callback;
  }

  /**
   * Starts the polling loop. Resolves immediately; polling runs in the background.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    logger.info({ message: 'NewsApiConnector starting', apiUrl: this.apiUrl });
    void this._pollWithBackoff();
  }

  /**
   * Stops the polling loop gracefully.
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info({ message: 'NewsApiConnector stopped' });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Main polling loop with exponential-backoff on failure.
   */
  private async _pollWithBackoff(): Promise<void> {
    let retryDelay = this.initialRetryDelayMs;

    while (this.running) {
      try {
        await this._fetchArticles();
        // Successful fetch — reset backoff and wait for the normal poll interval
        retryDelay = this.initialRetryDelayMs;
        await this._sleep(this.pollIntervalMs);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const statusCode =
          axios.isAxiosError(err)
            ? (err as AxiosError).response?.status
            : undefined;

        logger.error({
          message: 'NewsApiConnector: connection lost or fetch failed',
          apiUrl: this.apiUrl,
          errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
          errorMessage,
          statusCode,
          retryInMs: retryDelay,
        });

        // Wait before retrying with exponential backoff
        await this._sleep(retryDelay);
        retryDelay = Math.min(
          Math.floor(retryDelay * this.retryBackoffMultiplier * (1 + 0.1 * Math.random())),
          this.maxRetryDelayMs
        );
      }
    }
  }

  /**
   * Performs a single HTTP GET to the configured API endpoint and emits each
   * article in the response via the registered callback.
   */
  private async _fetchArticles(): Promise<void> {
    const response = await this.axiosInstance.get<unknown>(this.apiUrl);
    const data = response.data;

    // Support both an array of articles and an object with an `articles` array
    let articles: unknown[];
    if (Array.isArray(data)) {
      articles = data;
    } else if (
      data !== null &&
      typeof data === 'object' &&
      Array.isArray((data as Record<string, unknown>)['articles'])
    ) {
      articles = (data as Record<string, unknown>)['articles'] as unknown[];
    } else {
      // Treat the entire response as a single item
      articles = [data];
    }

    for (const article of articles) {
      if (this.onArticle) {
        this.onArticle(article);
      }
    }

    logger.debug({
      message: 'NewsApiConnector: fetched articles',
      count: articles.length,
    });
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollTimer = setTimeout(resolve, ms);
    });
  }
}
