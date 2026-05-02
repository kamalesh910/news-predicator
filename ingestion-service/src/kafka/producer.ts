/**
 * Kafka producer module for the ingestion-service.
 *
 * Wraps KafkaJS producer with:
 *   - connect/disconnect lifecycle methods
 *   - publish to `raw-news` topic
 *   - in-memory buffer (configurable limit) for when Kafka is unavailable
 *   - exponential-backoff reconnect logic
 *
 * Satisfies Requirements 1.1, 1.6, 11.1
 */

import { Kafka, Producer, KafkaConfig, Message } from 'kafkajs';
import { createLogger, format, transports } from 'winston';
import { RawNewsMessage } from '../types/RawNewsMessage';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: 'ingestion-service' },
  transports: [new transports.Console()],
});

export interface ProducerConfig {
  /** Kafka broker addresses, e.g. ['localhost:9092'] */
  brokers: string[];
  /** Client ID for this producer instance */
  clientId?: string;
  /** Maximum number of messages to buffer when Kafka is unavailable (default: 1000) */
  bufferLimit?: number;
  /** Initial reconnect delay in milliseconds (default: 500) */
  initialRetryDelayMs?: number;
  /** Maximum reconnect delay in milliseconds (default: 30000) */
  maxRetryDelayMs?: number;
  /** Multiplier applied to delay on each retry (default: 2) */
  retryBackoffMultiplier?: number;
}

interface BufferedMessage {
  message: RawNewsMessage;
  enqueuedAt: number;
}

const RAW_NEWS_TOPIC = 'raw-news';

export class NewsProducer {
  private readonly kafka: Kafka;
  private producer: Producer;
  private connected = false;
  private reconnecting = false;

  private readonly bufferLimit: number;
  private readonly buffer: BufferedMessage[] = [];

  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly retryBackoffMultiplier: number;

  constructor(config: ProducerConfig) {
    this.bufferLimit = config.bufferLimit ?? 1000;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? 500;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? 30_000;
    this.retryBackoffMultiplier = config.retryBackoffMultiplier ?? 2;

    const kafkaConfig: KafkaConfig = {
      clientId: config.clientId ?? 'ingestion-service-producer',
      brokers: config.brokers,
      retry: {
        // KafkaJS internal retry is disabled here; we manage reconnect ourselves
        retries: 0,
      },
    };

    this.kafka = new Kafka(kafkaConfig);
    this.producer = this.kafka.producer();
    this._attachErrorHandlers();
  }

  /**
   * Establishes the connection to Kafka.
   * Resolves when the producer is ready to send messages.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    await this.producer.connect();
    this.connected = true;
    logger.info({ message: 'Kafka producer connected', topic: RAW_NEWS_TOPIC });

    // Flush any buffered messages now that we are connected
    await this._flushBuffer();
  }

  /**
   * Gracefully disconnects the producer.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    await this.producer.disconnect();
    logger.info({ message: 'Kafka producer disconnected' });
  }

  /**
   * Publishes a RawNewsMessage to the `raw-news` Kafka topic.
   *
   * If Kafka is currently unavailable the message is placed in the in-memory
   * buffer (up to `bufferLimit`). Excess messages are dropped with a warning.
   *
   * @param message - The validated RawNewsMessage to publish
   */
  async publish(message: RawNewsMessage): Promise<void> {
    if (!this.connected) {
      this._bufferMessage(message);
      // Kick off a reconnect attempt if one is not already in progress
      if (!this.reconnecting) {
        void this._reconnectWithBackoff();
      }
      return;
    }

    const kafkaMessage: Message = {
      key: message.articleId,
      value: JSON.stringify(message),
    };

    try {
      await this.producer.send({
        topic: RAW_NEWS_TOPIC,
        messages: [kafkaMessage],
      });
      logger.debug({
        message: 'Published message to raw-news',
        articleId: message.articleId,
      });
    } catch (err) {
      logger.error({
        message: 'Failed to publish message; buffering',
        articleId: message.articleId,
        error: err instanceof Error ? err.message : String(err),
      });
      this.connected = false;
      this._bufferMessage(message);
      if (!this.reconnecting) {
        void this._reconnectWithBackoff();
      }
    }
  }

  /**
   * Returns the current number of messages held in the in-memory buffer.
   */
  get bufferedCount(): number {
    return this.buffer.length;
  }

  /**
   * Returns whether the producer is currently connected to Kafka.
   */
  get isConnected(): boolean {
    return this.connected;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _attachErrorHandlers(): void {
    this.producer.on('producer.disconnect', () => {
      if (this.connected) {
        this.connected = false;
        logger.warn({ message: 'Kafka producer disconnected unexpectedly' });
        if (!this.reconnecting) {
          void this._reconnectWithBackoff();
        }
      }
    });
  }

  /**
   * Adds a message to the in-memory buffer, respecting the configured limit.
   */
  private _bufferMessage(message: RawNewsMessage): void {
    if (this.buffer.length >= this.bufferLimit) {
      logger.warn({
        message: 'In-memory buffer full; dropping oldest message',
        droppedArticleId: this.buffer[0]?.message.articleId,
        bufferLimit: this.bufferLimit,
      });
      this.buffer.shift(); // drop oldest to make room
    }
    this.buffer.push({ message, enqueuedAt: Date.now() });
    logger.debug({
      message: 'Message buffered',
      articleId: message.articleId,
      bufferSize: this.buffer.length,
    });
  }

  /**
   * Attempts to reconnect to Kafka using exponential backoff.
   * Once connected, flushes the in-memory buffer.
   */
  private async _reconnectWithBackoff(): Promise<void> {
    this.reconnecting = true;
    let delay = this.initialRetryDelayMs;
    let attempt = 0;

    while (!this.connected) {
      attempt += 1;
      logger.info({
        message: `Kafka reconnect attempt ${attempt}; waiting ${delay}ms`,
      });

      await this._sleep(delay);

      try {
        // Create a fresh producer instance to avoid stale state
        this.producer = this.kafka.producer();
        this._attachErrorHandlers();
        await this.producer.connect();
        this.connected = true;
        logger.info({
          message: `Kafka producer reconnected after ${attempt} attempt(s)`,
        });
        await this._flushBuffer();
      } catch (err) {
        logger.warn({
          message: 'Kafka reconnect attempt failed',
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
        // Exponential backoff with jitter and cap
        delay = Math.min(
          Math.floor(delay * this.retryBackoffMultiplier * (1 + 0.1 * Math.random())),
          this.maxRetryDelayMs
        );
      }
    }

    this.reconnecting = false;
  }

  /**
   * Drains the in-memory buffer by publishing all buffered messages to Kafka.
   * Stops immediately if the connection drops again mid-flush.
   */
  private async _flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    logger.info({
      message: `Flushing ${this.buffer.length} buffered message(s) to Kafka`,
    });

    while (this.buffer.length > 0 && this.connected) {
      const entry = this.buffer[0];
      if (!entry) break;

      const kafkaMessage: Message = {
        key: entry.message.articleId,
        value: JSON.stringify(entry.message),
      };

      try {
        await this.producer.send({
          topic: RAW_NEWS_TOPIC,
          messages: [kafkaMessage],
        });
        this.buffer.shift();
        logger.debug({
          message: 'Flushed buffered message',
          articleId: entry.message.articleId,
          remaining: this.buffer.length,
        });
      } catch (err) {
        logger.error({
          message: 'Failed to flush buffered message; will retry on next reconnect',
          articleId: entry.message.articleId,
          error: err instanceof Error ? err.message : String(err),
        });
        this.connected = false;
        break;
      }
    }
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
