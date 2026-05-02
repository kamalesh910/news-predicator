/**
 * Property test for structured error log schema.
 *
 * **Property 22: Structured Error Log Contains Required Fields**
 *
 * For any arbitrary error object passed through the logger, the emitted
 * JSON log entry MUST contain all five required fields:
 *   - timestamp
 *   - serviceName
 *   - level
 *   - message
 *   - errorType
 *   - errorMessage
 *   - stackTrace
 *
 * **Validates: Requirements 12.6**
 */

import * as fc from 'fast-check';
import { createServiceLogger } from '../utils/logger';
import { transports, format } from 'winston';
import { Writable } from 'stream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a logger that captures output into an in-memory array instead of
 * writing to the console.  Returns the logger and a function to retrieve
 * captured log lines.
 */
function createCapturingLogger(serviceName: string) {
  const captured: string[] = [];

  // A proper Node.js Writable stream that collects log output
  const writableStream = new Writable({
    write(chunk: Buffer | string, _encoding: string, callback: () => void) {
      captured.push(chunk.toString().trim());
      callback();
    },
  });

  // A custom writable transport that pushes JSON strings into `captured`
  const memoryTransport = new transports.Stream({
    stream: writableStream,
  });

  const logger = createServiceLogger(serviceName);
  // Remove the default console transport and add our capturing transport
  logger.clear();
  logger.add(memoryTransport);
  // Re-apply the JSON format since we cleared the transports
  logger.format = format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
  );

  return {
    logger,
    getCaptured: () => captured,
  };
}

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('Property 22: Structured Error Log Contains Required Fields', () => {
  /**
   * For any arbitrary error (with a message and optional stack), the logger
   * MUST emit a JSON entry containing all five required fields.
   *
   * Validates: Requirements 12.6
   */
  it('emits all required fields for arbitrary error objects', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary error messages (non-empty strings)
        fc.string({ minLength: 1, maxLength: 200 }),
        // Generate arbitrary error type names (valid identifier-like strings)
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9_]{0,49}$/),
        // Generate arbitrary service names
        fc.constantFrom(
          'ingestion-service',
          'api-gateway',
          'analysis-service',
          'prediction-service',
        ),
        (errorMessage, errorType, serviceName) => {
          const { logger, getCaptured } = createCapturingLogger(serviceName);

          // Simulate what services do when logging an unhandled error
          const err = new Error(errorMessage);
          // Override the name to simulate different error types
          err.name = errorType;

          logger.error('Unhandled error', {
            errorType: err.name,
            errorMessage: err.message,
            stackTrace: err.stack ?? '',
          });

          const lines = getCaptured();
          expect(lines.length).toBeGreaterThanOrEqual(1);

          // Parse the last emitted log line as JSON
          const lastLine = lines[lines.length - 1];
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(lastLine) as Record<string, unknown>;
          } catch {
            throw new Error(`Logger did not emit valid JSON. Got: ${lastLine}`);
          }

          // Assert all five required fields are present and non-empty
          expect(parsed).toHaveProperty('timestamp');
          expect(typeof parsed['timestamp']).toBe('string');
          expect((parsed['timestamp'] as string).length).toBeGreaterThan(0);

          expect(parsed).toHaveProperty('serviceName');
          expect(parsed['serviceName']).toBe(serviceName);

          expect(parsed).toHaveProperty('level');
          expect(parsed['level']).toBe('error');

          expect(parsed).toHaveProperty('message');
          expect(typeof parsed['message']).toBe('string');

          expect(parsed).toHaveProperty('errorType');
          expect(parsed['errorType']).toBe(errorType);

          expect(parsed).toHaveProperty('errorMessage');
          expect(parsed['errorMessage']).toBe(errorMessage);

          expect(parsed).toHaveProperty('stackTrace');
          expect(typeof parsed['stackTrace']).toBe('string');
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * The timestamp field MUST be a valid ISO 8601 datetime string.
   *
   * Validates: Requirements 12.6
   */
  it('timestamp field is a valid ISO 8601 datetime string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorMessage) => {
          const { logger, getCaptured } = createCapturingLogger('ingestion-service');

          const err = new Error(errorMessage);
          logger.error('Unhandled error', {
            errorType: err.constructor.name,
            errorMessage: err.message,
            stackTrace: err.stack ?? '',
          });

          const lines = getCaptured();
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine) as Record<string, unknown>;

          const timestamp = parsed['timestamp'] as string;
          const date = new Date(timestamp);
          expect(isNaN(date.getTime())).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * The serviceName field MUST match the name passed to createServiceLogger.
   *
   * Validates: Requirements 12.6
   */
  it('serviceName field matches the configured service name', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,29}$/),
        (serviceName) => {
          const { logger, getCaptured } = createCapturingLogger(serviceName);

          logger.error('Test error', {
            errorType: 'TestError',
            errorMessage: 'test',
            stackTrace: 'Error: test\n    at test',
          });

          const lines = getCaptured();
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine) as Record<string, unknown>;

          expect(parsed['serviceName']).toBe(serviceName);
        },
      ),
      { numRuns: 50 },
    );
  });
});
