import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { DbService } from '../db/db.service';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { serviceName: 'api-gateway', module: 'ArticlesService' },
  transports: [new winston.transports.Console()],
});

/** Represents a row from the `articles` table. */
export interface Article {
  article_id: string;
  source_url: string;
  title: string;
  body: string;
  source_name: string;
  published_at: string;
  schema_version: string;
  ingested_at: string;
  bias_score: number | null;
  bias_label: string | null;
}

/** Represents a row from the `bias_records` table joined with article data. */
export interface BiasRecord {
  record_id: string;
  article_id: string;
  bias_score: number | null;
  bias_label: string | null;
  analysis_timestamp: string;
  error_flag: boolean;
}

/** Represents a prediction record — either a burst_event or trend_forecast row. */
export interface Prediction {
  type: 'burst_event' | 'trend_forecast';
  id: string;
  topic_name: string;
  created_at: string;
  [key: string]: unknown;
}

/** Maximum number of records returned per page. */
const MAX_PAGE_SIZE = 100;

/**
 * NestJS service providing data-access methods for articles, bias scores,
 * predictions, and WebSocket event delivery audit logging.
 *
 * All queries are executed via DbService (node-postgres pool).
 */
@Injectable()
export class ArticlesService {
  constructor(private readonly db: DbService) {}

  /**
   * Returns a paginated list of articles ordered by publication date descending.
   *
   * @param page     - 1-based page number.
   * @param pageSize - Number of records per page (capped at MAX_PAGE_SIZE).
   */
  async getArticles(page: number, pageSize: number): Promise<Article[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const offset = (page - 1) * safePageSize;

    const result = await this.db.query(
      `SELECT
  a.article_id,
  a.source_url,
  a.title,
  a.body,
  a.source_name,
  a.published_at,
  a.schema_version,
  a.ingested_at,
  br.bias_score,
  br.bias_label
FROM articles a
LEFT JOIN LATERAL (
  SELECT bias_score, bias_label
  FROM bias_records
  WHERE article_id = a.article_id
  ORDER BY analysis_timestamp DESC
  LIMIT 1
) br ON true
ORDER BY a.published_at DESC
LIMIT $1 OFFSET $2`,
      [safePageSize, offset],
    );

    logger.info({
      message: 'getArticles query completed',
      page,
      pageSize: safePageSize,
      rowCount: result.rowCount,
    });

    return result.rows as Article[];
  }

  /**
   * Returns a single article by its UUID, or null if not found.
   *
   * @param id - The article UUID.
   */
  async getArticleById(id: string): Promise<Article | null> {
    const result = await this.db.query(
      `SELECT article_id, source_url, title, body, source_name,
              published_at, schema_version, ingested_at
       FROM articles
       WHERE article_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      logger.info({ message: 'getArticleById — not found', articleId: id });
      return null;
    }

    return result.rows[0] as Article;
  }

  /**
   * Returns a paginated list of bias records ordered by analysis timestamp descending.
   *
   * @param page     - 1-based page number.
   * @param pageSize - Number of records per page (capped at MAX_PAGE_SIZE).
   */
  async getBiasScores(page: number, pageSize: number): Promise<BiasRecord[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const offset = (page - 1) * safePageSize;

    const result = await this.db.query(
      `SELECT record_id, article_id, bias_score, bias_label,
              analysis_timestamp, error_flag
       FROM bias_records
       ORDER BY analysis_timestamp DESC
       LIMIT $1 OFFSET $2`,
      [safePageSize, offset],
    );

    logger.info({
      message: 'getBiasScores query completed',
      page,
      pageSize: safePageSize,
      rowCount: result.rowCount,
    });

    return result.rows as BiasRecord[];
  }

  /**
   * Returns a paginated list of predictions (burst events and trend forecasts)
   * merged and ordered by creation time descending.
   *
   * @param page     - 1-based page number.
   * @param pageSize - Number of records per page (capped at MAX_PAGE_SIZE).
   */
  async getPredictions(page: number, pageSize: number): Promise<Prediction[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const offset = (page - 1) * safePageSize;

    const result = await this.db.query(
      `SELECT 'burst_event'    AS type,
              event_id         AS id,
              topic_name,
              article_count,
              window_start,
              window_end,
              detection_timestamp AS created_at
       FROM burst_events
       UNION ALL
       SELECT 'trend_forecast' AS type,
              forecast_id      AS id,
              topic_name,
              NULL             AS article_count,
              NULL             AS window_start,
              NULL             AS window_end,
              created_at
       FROM trend_forecasts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [safePageSize, offset],
    );

    logger.info({
      message: 'getPredictions query completed',
      page,
      pageSize: safePageSize,
      rowCount: result.rowCount,
    });

    return result.rows as Prediction[];
  }

  /**
   * Writes a WebSocket event delivery audit record to the `ws_event_log` table.
   *
   * @param articleId - The article ID associated with the event (used as session_id).
   * @param clientId  - The WebSocket client/session identifier.
   * @param eventType - The type of event delivered (e.g. 'burst_event', 'trend_forecast').
   */
  async logWsEventDelivery(
    articleId: string,
    clientId: string,
    eventType: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO ws_event_log (session_id, event_type, payload)
       VALUES ($1, $2, $3)`,
      [clientId, eventType, JSON.stringify({ articleId })],
    );

    logger.info({
      message: 'WebSocket event delivery logged',
      articleId,
      clientId,
      eventType,
    });
  }
}
