import { RawNewsMessage } from '../types/RawNewsMessage';

/**
 * ISO 8601 datetime regex — accepts full datetime strings with optional fractional seconds and timezone.
 * Examples: "2024-01-15T10:30:00Z", "2024-01-15T10:30:00.000Z", "2024-01-15T10:30:00+05:30"
 */
const ISO_8601_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Validates an unknown input and returns a typed RawNewsMessage if all required fields are present
 * and well-formed. Throws a descriptive Error if any required field is missing or invalid.
 *
 * Required fields: title, sourceName (source), publishedAt (timestamp), articleId, sourceUrl,
 * body, schemaVersion.
 *
 * Satisfies Requirements 1.4, 2.1, 2.2, 2.3
 *
 * @param input - The raw unknown value to validate (typically parsed JSON from an external source)
 * @returns A fully-typed RawNewsMessage
 * @throws Error with a descriptive message if validation fails
 */
export function validateRawArticle(input: unknown): RawNewsMessage {
  if (input === null || typeof input !== 'object') {
    throw new Error('Validation failed: input must be a non-null object');
  }

  const record = input as Record<string, unknown>;

  // --- title ---
  if (!record['title'] || typeof record['title'] !== 'string' || record['title'].trim() === '') {
    throw new Error(
      'Validation failed: "title" is required and must be a non-empty string'
    );
  }

  // --- sourceName (source) ---
  if (
    !record['sourceName'] ||
    typeof record['sourceName'] !== 'string' ||
    record['sourceName'].trim() === ''
  ) {
    throw new Error(
      'Validation failed: "sourceName" is required and must be a non-empty string'
    );
  }

  // --- publishedAt (timestamp) ---
  if (
    !record['publishedAt'] ||
    typeof record['publishedAt'] !== 'string' ||
    record['publishedAt'].trim() === ''
  ) {
    throw new Error(
      'Validation failed: "publishedAt" is required and must be a non-empty string'
    );
  }

  if (!ISO_8601_REGEX.test(record['publishedAt'].trim())) {
    throw new Error(
      `Validation failed: "publishedAt" must be a valid ISO 8601 datetime string (received: "${record['publishedAt']}")`
    );
  }

  // --- articleId ---
  if (
    !record['articleId'] ||
    typeof record['articleId'] !== 'string' ||
    record['articleId'].trim() === ''
  ) {
    throw new Error(
      'Validation failed: "articleId" is required and must be a non-empty string'
    );
  }

  // --- sourceUrl ---
  if (
    !record['sourceUrl'] ||
    typeof record['sourceUrl'] !== 'string' ||
    record['sourceUrl'].trim() === ''
  ) {
    throw new Error(
      'Validation failed: "sourceUrl" is required and must be a non-empty string'
    );
  }

  // --- body ---
  if (typeof record['body'] !== 'string') {
    throw new Error(
      'Validation failed: "body" is required and must be a string'
    );
  }

  // --- schemaVersion ---
  if (
    !record['schemaVersion'] ||
    typeof record['schemaVersion'] !== 'string' ||
    record['schemaVersion'].trim() === ''
  ) {
    throw new Error(
      'Validation failed: "schemaVersion" is required and must be a non-empty string'
    );
  }

  return {
    articleId: record['articleId'].trim(),
    sourceUrl: record['sourceUrl'].trim(),
    title: record['title'].trim(),
    body: record['body'] as string,
    sourceName: record['sourceName'].trim(),
    publishedAt: record['publishedAt'].trim(),
    schemaVersion: record['schemaVersion'].trim(),
  };
}
