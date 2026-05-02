/**
 * Health endpoint for the ingestion-service.
 *
 * Exposes GET /health returning HTTP 200 with a JSON service status payload.
 * Uses Node's built-in `http` module (no Express dependency).
 *
 * Satisfies Requirements 12.1, 12.6, 12.7
 */

import http, { IncomingMessage, ServerResponse } from 'http';
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  defaultMeta: { service: 'ingestion-service', module: 'healthRouter' },
  transports: [new transports.Console()],
});

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  uptime: number;
  /** Optional map of dependency names to their connectivity status */
  dependencies?: Record<string, 'connected' | 'disconnected' | 'unknown'>;
}

export interface HealthRouterOptions {
  /** TCP port to listen on (default: 3001) */
  port?: number;
  /** Hostname to bind to (default: '0.0.0.0') */
  host?: string;
  /** Callback invoked when the server is ready */
  onListening?: (port: number) => void;
}

/**
 * Creates and starts a lightweight HTTP server that serves the health endpoint.
 *
 * @param getStatus - A function that returns the current HealthStatus snapshot.
 *                    Called on every request so the response is always fresh.
 * @param options   - Optional configuration for port, host, and lifecycle hooks.
 * @returns The underlying `http.Server` instance (caller can call `.close()` to stop it).
 */
export function createHealthServer(
  getStatus: () => HealthStatus,
  options: HealthRouterOptions = {}
): http.Server {
  const port = options.port ?? 3001;
  const host = options.host ?? '0.0.0.0';

  const server = http.createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === '/health') {
        const status = getStatus();
        const body = JSON.stringify(status);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        });
        res.end(body);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    }
  );

  server.listen(port, host, () => {
    logger.info({
      message: `Health endpoint listening on http://${host}:${port}/health`,
    });
    if (options.onListening) {
      options.onListening(port);
    }
  });

  server.on('error', (err: Error) => {
    logger.error({
      message: 'Health server error',
      errorType: err.constructor.name,
      errorMessage: err.message,
      stack: err.stack,
    });
  });

  return server;
}
