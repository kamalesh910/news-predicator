import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as winston from 'winston';
import { configuration } from '../config/configuration';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { serviceName: 'api-gateway', module: 'HealthController' },
  transports: [new winston.transports.Console()],
});

export interface DependencyStatus {
  kafka: 'ok' | 'error';
  postgres: 'ok' | 'error';
  redis: 'ok' | 'error';
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  dependencies: DependencyStatus;
}

/**
 * Lightweight health controller that pings each dependency and returns
 * an aggregated status. HTTP 200 is returned regardless of dependency
 * state so that load-balancers can always read the response body; the
 * `status` field distinguishes "ok" from "degraded".
 *
 * Implements Requirement 7.8 and 12.4.
 */
@Controller('health')
export class HealthController {
  /**
   * GET /health
   *
   * Checks Kafka, PostgreSQL, and Redis connectivity.
   * Returns HTTP 200 with a JSON body describing each dependency's state.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<HealthResponse> {
    const config = configuration();

    const [kafkaStatus, postgresStatus, redisStatus] = await Promise.all([
      checkKafka(config.kafkaBrokers),
      checkPostgres(config.postgres),
      checkRedis(config.redisUrl),
    ]);

    const allOk =
      kafkaStatus === 'ok' && postgresStatus === 'ok' && redisStatus === 'ok';

    const response: HealthResponse = {
      status: allOk ? 'ok' : 'degraded',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      dependencies: {
        kafka: kafkaStatus,
        postgres: postgresStatus,
        redis: redisStatus,
      },
    };

    if (!allOk) {
      logger.warn({
        message: 'Health check returned degraded status',
        dependencies: response.dependencies,
      });
    }

    return response;
  }
}

// ---------------------------------------------------------------------------
// Dependency ping helpers
// ---------------------------------------------------------------------------

async function checkKafka(brokers: string[]): Promise<'ok' | 'error'> {
  const kafka = new Kafka({
    clientId: 'api-gateway-health-check',
    brokers,
    // Short timeouts so the health endpoint stays responsive
    connectionTimeout: 3_000,
    requestTimeout: 3_000,
  });
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.disconnect();
    return 'ok';
  } catch (err) {
    logger.warn({
      message: 'Kafka health check failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return 'error';
  }
}

async function checkPostgres(
  pgConfig: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  },
): Promise<'ok' | 'error'> {
  const pool = new Pool({
    host: pgConfig.host,
    port: pgConfig.port,
    database: pgConfig.database,
    user: pgConfig.user,
    password: pgConfig.password,
    max: 1,
    connectionTimeoutMillis: 3_000,
  });
  try {
    await pool.query('SELECT 1');
    return 'ok';
  } catch (err) {
    logger.warn({
      message: 'PostgreSQL health check failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return 'error';
  } finally {
    await pool.end().catch(() => {
      // Ignore pool-end errors during health check
    });
  }
}

async function checkRedis(redisUrl: string): Promise<'ok' | 'error'> {
  const client = new Redis(redisUrl, {
    connectTimeout: 3_000,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  });
  try {
    await client.connect();
    await client.ping();
    return 'ok';
  } catch (err) {
    logger.warn({
      message: 'Redis health check failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return 'error';
  } finally {
    client.disconnect();
  }
}
