/**
 * Represents a raw news article or social media post published to the `raw-news` Kafka topic.
 * All fields are required. publishedAt must be an ISO 8601 datetime string.
 * Satisfies Requirements 2.1, 2.2, 2.3
 */
export interface RawNewsMessage {
  /** UUID v4 unique identifier assigned by the ingestion service */
  articleId: string;

  /** URL of the original article or post */
  sourceUrl: string;

  /** Headline or title of the article */
  title: string;

  /** Full body text of the article */
  body: string;

  /** Name of the news source or social media platform */
  sourceName: string;

  /** Publication timestamp in ISO 8601 format (e.g. "2024-01-15T10:30:00.000Z") */
  publishedAt: string;

  /** Schema version for forward compatibility (e.g. "1.0") */
  schemaVersion: string;
}
