/**
 * Loads all environment variables required by the API Gateway.
 * Returns a typed configuration object with sensible defaults.
 */
export interface AppConfiguration {
  kafkaBrokers: string[];
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  redisUrl: string;
  sessionTtl: number;
  apiGatewayPort: number;
  wsPort: number;
}

export function configuration(): AppConfiguration {
  return {
    kafkaBrokers: (process.env['KAFKA_BROKERS'] ?? 'localhost:9092').split(','),
    postgres: {
      host: process.env['POSTGRES_HOST'] ?? 'localhost',
      port: parseInt(process.env['POSTGRES_PORT'] ?? '5432', 10),
      database: process.env['POSTGRES_DB'] ?? 'ainews',
      user: process.env['POSTGRES_USER'] ?? 'postgres',
      password: process.env['POSTGRES_PASSWORD'] ?? '',
    },
    redisUrl: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    sessionTtl: parseInt(process.env['SESSION_TTL'] ?? '3600', 10),
    apiGatewayPort: parseInt(process.env['API_GATEWAY_PORT'] ?? '4000', 10),
    wsPort: parseInt(process.env['WS_PORT'] ?? '4000', 10),
  };
}
