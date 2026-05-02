/**
 * ingestion-service entry point.
 *
 * Wires together:
 *   - NewsApiConnector  (HTTP polling)
 *   - SocialStreamConnector (WebSocket stream)
 *   - validateRawArticle (schema validation)
 *   - NewsProducer (Kafka publisher with in-memory buffer)
 *   - Health endpoint (GET /health via Node's built-in http module)
 *
 * Satisfies Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 12.1, 12.6, 12.7
 */

import { createLogger, format, transports } from 'winston';
import { v4 as uuidv4 } from 'uuid';

import { NewsProducer } from './kafka/producer';
import { NewsApiConnector } from './connectors/newsApiConnector';
import { SocialStreamConnector } from './connectors/socialStreamConnector';
import { validateRawArticle } from './utils/validate';
import { createHealthServer, HealthStatus } from './health/healthRouter';
import { RawNewsMessage } from './types/RawNewsMessage';

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: 'ingestion-service' },
  transports: [new transports.Console()],
});

// ---------------------------------------------------------------------------
// Configuration (read from environment variables with sensible defaults)
// ---------------------------------------------------------------------------

const KAFKA_BROKERS = (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(',');
const KAFKA_BUFFER_LIMIT = parseInt(process.env['KAFKA_BUFFER_LIMIT'] ?? '1000', 10);

const NEWS_API_URL = process.env['NEWS_API_URL'] ?? 'http://localhost:4000/articles';
const NEWS_API_KEY = process.env['NEWS_API_KEY'];
const NEWS_API_POLL_INTERVAL_MS = parseInt(
  process.env['NEWS_API_POLL_INTERVAL_MS'] ?? '60000',
  10
);

const SOCIAL_STREAM_URL = process.env['SOCIAL_STREAM_URL'] ?? 'ws://localhost:4001/stream';
const SOCIAL_STREAM_AUTH_TOKEN = process.env['SOCIAL_STREAM_AUTH_TOKEN'];

const HEALTH_PORT = parseInt(process.env['HEALTH_PORT'] ?? '3001', 10);

const SCHEMA_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Dependency state (used by the health endpoint)
// ---------------------------------------------------------------------------

let kafkaConnected = false;

// ---------------------------------------------------------------------------
// Helper: build and validate a RawNewsMessage from an unknown payload
// ---------------------------------------------------------------------------

function buildAndValidate(raw: unknown): RawNewsMessage | null {
  try {
    // Enrich with an articleId if the source didn't provide one
    const enriched =
      raw !== null && typeof raw === 'object'
        ? {
            articleId: uuidv4(),
            schemaVersion: SCHEMA_VERSION,
            ...(raw as Record<string, unknown>),
          }
        : raw;

    return validateRawArticle(enriched);
  } catch (err) {
    logger.error({
      message: 'Discarding malformed article',
      errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  logger.info({ message: 'ingestion-service starting up' });

  // --- Kafka producer ---
  const producer = new NewsProducer({
    brokers: KAFKA_BROKERS,
    clientId: 'ingestion-service-producer',
    bufferLimit: KAFKA_BUFFER_LIMIT,
  });

  try {
    await producer.connect();
    kafkaConnected = true;
    logger.info({ message: 'Kafka producer connected successfully' });
  } catch (err) {
    logger.warn({
      message: 'Kafka not reachable at startup; buffering enabled',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    // The producer will reconnect with backoff in the background
  }

  // --- Article handler: validate → publish ---
  async function handleArticle(raw: unknown): Promise<void> {
    const article = buildAndValidate(raw);
    if (!article) {
      return; // already logged inside buildAndValidate
    }
    try {
      await producer.publish(article);
    } catch (err) {
      logger.error({
        message: 'Failed to publish article to Kafka',
        articleId: article.articleId,
        errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
        stackTrace: err instanceof Error ? (err.stack ?? '') : '',
      });
    }
  }

  // --- News API connector ---
  const newsApiConnector = new NewsApiConnector({
    apiUrl: NEWS_API_URL,
    apiKey: NEWS_API_KEY,
    pollIntervalMs: NEWS_API_POLL_INTERVAL_MS,
  });
  newsApiConnector.onData((article) => {
    void handleArticle(article);
  });
  newsApiConnector.start();

  // --- Social stream connector ---
  const socialStreamConnector = new SocialStreamConnector({
    streamUrl: SOCIAL_STREAM_URL,
    authToken: SOCIAL_STREAM_AUTH_TOKEN,
  });
  socialStreamConnector.onData((message) => {
    void handleArticle(message);
  });
  socialStreamConnector.start();

  // --- Health endpoint ---
  const healthServer = createHealthServer(
    (): HealthStatus => ({
      status: kafkaConnected ? 'ok' : 'degraded',
      service: 'ingestion-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      dependencies: {
        kafka: kafkaConnected ? 'connected' : 'disconnected',
      },
    }),
    { port: HEALTH_PORT }
  );

  // --- Structured startup log ---
  logger.info({
    message: 'ingestion-service started successfully',
    kafkaBrokers: KAFKA_BROKERS,
    newsApiUrl: NEWS_API_URL,
    socialStreamUrl: SOCIAL_STREAM_URL,
    healthPort: HEALTH_PORT,
  });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ message: `Received ${signal}; shutting down gracefully` });
    newsApiConnector.stop();
    socialStreamConnector.stop();
    healthServer.close();
    await producer.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });
}

main().catch((err: unknown) => {
  logger.error({
    message: 'ingestion-service fatal startup error',
    errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
    errorMessage: err instanceof Error ? err.message : String(err),
    stackTrace: err instanceof Error ? (err.stack ?? '') : '',
  });
  process.exit(1);
});
