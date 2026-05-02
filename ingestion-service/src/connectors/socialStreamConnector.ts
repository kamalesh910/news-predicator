/**
 * SocialStreamConnector — WebSocket-based social media stream connector.
 *
 * Features:
 *   - Connects to a WebSocket endpoint and emits each received message via a callback
 *   - Exponential-backoff reconnect on connection loss or error
 *   - Structured error logging on disconnect
 *
 * Satisfies Requirements 1.2, 1.3, 1.6
 */

import { createLogger, format, transports } from 'winston';
import { WebSocket } from 'ws';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: 'ingestion-service', connector: 'SocialStreamConnector' },
  transports: [new transports.Console()],
});

export interface SocialStreamConnectorConfig {
  /** WebSocket URL of the social media stream endpoint */
  streamUrl: string;
  /** Optional bearer token sent as the `Authorization` header on connect */
  authToken?: string;
  /** Initial reconnect delay in milliseconds (default: 1 000) */
  initialRetryDelayMs?: number;
  /** Maximum reconnect delay in milliseconds (default: 60 000) */
  maxRetryDelayMs?: number;
  /** Backoff multiplier applied on each failed attempt (default: 2) */
  retryBackoffMultiplier?: number;
}

export type MessageCallback = (message: unknown) => void;

export class SocialStreamConnector {
  private readonly streamUrl: string;
  private readonly authToken: string | undefined;
  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly retryBackoffMultiplier: number;

  private onMessage: MessageCallback | null = null;
  private ws: WebSocket | null = null;
  private running = false;
  private reconnecting = false;
  private currentRetryDelay: number;

  constructor(config: SocialStreamConnectorConfig) {
    this.streamUrl = config.streamUrl;
    this.authToken = config.authToken;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? 1_000;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? 60_000;
    this.retryBackoffMultiplier = config.retryBackoffMultiplier ?? 2;
    this.currentRetryDelay = this.initialRetryDelayMs;
  }

  /**
   * Registers the callback that will be invoked for each message received.
   */
  onData(callback: MessageCallback): void {
    this.onMessage = callback;
  }

  /**
   * Opens the WebSocket connection. Reconnects automatically on failure.
   */
  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    logger.info({
      message: 'SocialStreamConnector starting',
      streamUrl: this.streamUrl,
    });
    this._connect();
  }

  /**
   * Stops the connector and closes the WebSocket connection.
   */
  stop(): void {
    this.running = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info({ message: 'SocialStreamConnector stopped' });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _connect(): void {
    if (!this.running) {
      return;
    }

    const headers: Record<string, string> = {};
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      this.ws = new WebSocket(this.streamUrl, { headers });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error({
        message: 'SocialStreamConnector: failed to create WebSocket',
        streamUrl: this.streamUrl,
        errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
        errorMessage,
      });
      this._scheduleReconnect();
      return;
    }

    this.ws.on('open', () => {
      logger.info({
        message: 'SocialStreamConnector: WebSocket connected',
        streamUrl: this.streamUrl,
      });
      // Reset backoff on successful connection
      this.currentRetryDelay = this.initialRetryDelayMs;
      this.reconnecting = false;
    });

    this.ws.on('message', (data: Buffer | string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        // If not JSON, pass the raw string
        parsed = data.toString();
      }

      if (this.onMessage) {
        this.onMessage(parsed);
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      logger.warn({
        message: 'SocialStreamConnector: WebSocket disconnected',
        streamUrl: this.streamUrl,
        closeCode: code,
        reason: reason.toString(),
      });
      this.ws = null;
      this._scheduleReconnect();
    });

    this.ws.on('error', (err: Error) => {
      logger.error({
        message: 'SocialStreamConnector: WebSocket error',
        streamUrl: this.streamUrl,
        errorType: err.constructor.name,
        errorMessage: err.message,
      });
      // The 'close' event will fire after 'error', triggering reconnect there
    });
  }

  /**
   * Schedules a reconnect attempt after the current backoff delay, then
   * increases the delay for the next potential failure.
   */
  private _scheduleReconnect(): void {
    if (!this.running || this.reconnecting) {
      return;
    }
    this.reconnecting = true;

    const delay = this.currentRetryDelay;
    logger.info({
      message: `SocialStreamConnector: reconnecting in ${delay}ms`,
      streamUrl: this.streamUrl,
    });

    setTimeout(() => {
      this.reconnecting = false;
      this._connect();
    }, delay);

    // Increase delay for the next failure (with jitter and cap)
    this.currentRetryDelay = Math.min(
      Math.floor(delay * this.retryBackoffMultiplier * (1 + 0.1 * Math.random())),
      this.maxRetryDelayMs
    );
  }
}
