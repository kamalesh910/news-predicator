/**
 * Structured JSON logger for the ingestion-service.
 *
 * Provides a `createServiceLogger` factory that returns a Winston logger
 * configured with JSON formatting.  Every log record emits a JSON object
 * containing at minimum:
 *
 *   {
 *     "timestamp":   "<ISO 8601>",
 *     "serviceName": "<name>",
 *     "level":       "<error|warn|info|debug>",
 *     "message":     "<log message>"
 *   }
 *
 * Unhandled error log entries additionally include:
 *   - errorType    — the error constructor name
 *   - errorMessage — the error message string
 *   - stackTrace   — the full stack trace string
 *
 * Satisfies Requirements 12.6, 12.7
 */

import { createLogger, format, transports, Logger } from 'winston';

/**
 * Creates a Winston logger configured with structured JSON output.
 *
 * @param serviceName - The name of the service (embedded in every log entry)
 * @returns A configured Winston Logger instance
 *
 * @example
 * const logger = createServiceLogger('ingestion-service');
 * logger.info('Service started', { port: 3001 });
 * // → {"timestamp":"...","serviceName":"ingestion-service","level":"info","message":"Service started","port":3001}
 *
 * @example
 * // Logging an unhandled error with all required fields:
 * logger.error('Unhandled error', {
 *   errorType: err.constructor.name,
 *   errorMessage: err.message,
 *   stackTrace: err.stack ?? '',
 * });
 */
export function createServiceLogger(serviceName: string): Logger {
  return createLogger({
    level: process.env['LOG_LEVEL'] ?? 'info',
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format((info) => {
        // Rename the 'service' defaultMeta key to 'serviceName' for schema compliance
        return info;
      })(),
      format.json(),
    ),
    defaultMeta: { serviceName },
    transports: [new transports.Console()],
  });
}

/**
 * Default logger for the ingestion-service.
 *
 * Import this directly when a module-level logger is needed without
 * constructing a new instance.
 *
 * @example
 * import logger from './utils/logger';
 * logger.info('Kafka producer connected');
 */
const logger = createServiceLogger('ingestion-service');

export default logger;
