import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configuration } from './config/configuration';
import { ValidationPipe } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Structured JSON error logging for unhandled exceptions
// ---------------------------------------------------------------------------

process.on('uncaughtException', (err: Error) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'error',
      errorType: err.constructor.name,
      errorMessage: err.message,
      stackTrace: err.stack ?? '',
    }),
  );
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'error',
      errorType: err.constructor.name,
      errorMessage: err.message,
      stackTrace: err.stack ?? '',
    }),
  );
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Startup dependency verification — non-fatal warnings only
// Kafka broker reachability is checked; topic existence is NOT required
// (kafka-init runs in parallel and creates topics after Kafka is healthy)
// ---------------------------------------------------------------------------

async function verifyDependencies(): Promise<void> {
  const config = configuration();

  // --- Kafka broker ping (not topic check) ---
  const kafka = new Kafka({
    clientId: 'api-gateway-startup-check',
    brokers: config.kafkaBrokers,
    connectionTimeout: 5_000,
    requestTimeout: 5_000,
  });
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.disconnect();
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'info',
      message: 'Startup check: Kafka broker reachable',
    }));
  } catch (err) {
    // Log as warning — KafkaJS consumer will retry on its own
    console.warn(JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'warn',
      message: `Startup check: Kafka not yet reachable — will retry: ${err instanceof Error ? err.message : String(err)}`,
    }));
  }

  // --- PostgreSQL ---
  const pool = new Pool({
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
    max: 1,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await pool.query('SELECT 1');
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'info',
      message: 'Startup check: PostgreSQL reachable',
    }));
  } catch (err) {
    await pool.end().catch(() => undefined);
    throw new Error(
      `Startup dependency check failed — PostgreSQL unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  await pool.end().catch(() => undefined);

  // --- Redis ---
  const redisClient = new Redis(config.redisUrl, {
    connectTimeout: 5_000,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
  });
  try {
    await redisClient.connect();
    await redisClient.ping();
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'info',
      message: 'Startup check: Redis reachable',
    }));
  } catch (err) {
    redisClient.disconnect();
    throw new Error(
      `Startup dependency check failed — Redis unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  redisClient.disconnect();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  const config = configuration();

  await verifyDependencies();

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(config.apiGatewayPort);

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'info',
      message: `API Gateway listening on port ${config.apiGatewayPort}`,
      dependencies: { kafka: 'ok', postgres: 'ok', redis: 'ok' },
    }),
  );
}

bootstrap().catch((err: unknown) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      serviceName: 'api-gateway',
      level: 'error',
      errorType: err instanceof Error ? err.constructor.name : 'UnknownError',
      errorMessage: err instanceof Error ? err.message : String(err),
      stackTrace: err instanceof Error ? (err.stack ?? '') : '',
    }),
  );
  process.exit(1);
});
