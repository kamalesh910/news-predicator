import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import * as winston from 'winston';
import { configuration } from '../config/configuration';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { serviceName: 'api-gateway', module: 'DbService' },
  transports: [new winston.transports.Console()],
});

/**
 * NestJS service that manages a PostgreSQL connection pool using node-postgres (pg).
 *
 * Configuration is read from the application configuration() function which
 * sources values from environment variables:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 *
 * The pool is created on module init and destroyed on module destroy.
 */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  onModuleInit(): void {
    const { postgres } = configuration();

    this.pool = new Pool({
      host: postgres.host,
      port: postgres.port,
      database: postgres.database,
      user: postgres.user,
      password: postgres.password,
      // Sensible pool defaults
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err: Error) => {
      logger.error({
        message: 'Unexpected PostgreSQL pool error',
        errorType: err.name,
        errorMessage: err.message,
        stackTrace: err.stack,
      });
    });

    logger.info({
      message: 'PostgreSQL connection pool initialised',
      host: postgres.host,
      port: postgres.port,
      database: postgres.database,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info({ message: 'PostgreSQL connection pool closed' });
    }
  }

  /**
   * Executes a parameterised SQL query against the PostgreSQL pool.
   *
   * @param text   - The SQL query string (use $1, $2, … placeholders).
   * @param params - Optional array of parameter values.
   * @returns      The pg QueryResult.
   */
  async query(text: string, params?: unknown[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.info({
        message: 'PostgreSQL query executed',
        query: text,
        durationMs: duration,
        rowCount: result.rowCount,
      });
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      logger.error({
        message: 'PostgreSQL query failed',
        query: text,
        durationMs: duration,
        errorType: err instanceof Error ? err.name : 'UnknownError',
        errorMessage: err instanceof Error ? err.message : String(err),
        stackTrace: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }
  }
}
