-- =============================================================================
-- AI News Reader and Predictor — PostgreSQL Schema
-- =============================================================================
-- This file is automatically executed by the official postgres Docker image
-- on first container start (mounted into /docker-entrypoint-initdb.d/).
--
-- Tables:
--   articles        — raw and analyzed news articles
--   bias_records    — BERT caste-bias analysis results (FK → articles)
--   burst_events    — Flink burst detection events
--   trend_forecasts — Flink trend forecast records
--   ws_event_log    — WebSocket event delivery audit log
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------------
-- Central archive of every ingested news article. The analysis-service writes
-- here after BERT inference; the api-gateway reads here for REST queries.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
    article_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url       TEXT          NOT NULL,
    title            TEXT          NOT NULL,
    body             TEXT          NOT NULL,
    source_name      TEXT          NOT NULL,
    published_at     TIMESTAMPTZ   NOT NULL,
    schema_version   VARCHAR(16)   NOT NULL DEFAULT '1.0',
    ingested_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for time-range queries (most common dashboard query pattern)
CREATE INDEX IF NOT EXISTS idx_articles_published_at
    ON articles (published_at DESC);

-- Index for source-based filtering
CREATE INDEX IF NOT EXISTS idx_articles_source_name
    ON articles (source_name);

-- ---------------------------------------------------------------------------
-- bias_records
-- ---------------------------------------------------------------------------
-- One record per article per analysis run. Linked to articles via FK.
-- error_flag is TRUE when BERT inference failed (bias_score may be NULL).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bias_records (
    record_id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id           UUID          NOT NULL
                             REFERENCES articles (article_id)
                             ON DELETE CASCADE,
    bias_score           FLOAT         CHECK (bias_score IS NULL OR (bias_score >= 0.0 AND bias_score <= 1.0)),
    bias_label           VARCHAR(64),
    analysis_timestamp   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    error_flag           BOOLEAN       NOT NULL DEFAULT FALSE
);

-- Index for joining back to articles
CREATE INDEX IF NOT EXISTS idx_bias_records_article_id
    ON bias_records (article_id);

-- Index for filtering by bias score range (heatmap queries)
CREATE INDEX IF NOT EXISTS idx_bias_records_bias_score
    ON bias_records (bias_score);

-- Index for time-range queries on analysis results
CREATE INDEX IF NOT EXISTS idx_bias_records_analysis_timestamp
    ON bias_records (analysis_timestamp DESC);

-- ---------------------------------------------------------------------------
-- burst_events
-- ---------------------------------------------------------------------------
-- Records every Burst_Event emitted by the Flink burst detection operator.
-- Not linked to a specific article; represents a topic-level aggregate.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS burst_events (
    event_id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name            TEXT          NOT NULL,
    platform              TEXT          NOT NULL DEFAULT 'Unknown',
    article_count         INT           NOT NULL CHECK (article_count > 0),
    avg_bias_score        FLOAT         CHECK (avg_bias_score IS NULL OR (avg_bias_score >= 0.0 AND avg_bias_score <= 1.0)),
    trend_direction       CHAR(1)       NOT NULL DEFAULT '→' CHECK (trend_direction IN ('↑', '↓', '→')),
    window_start          TIMESTAMPTZ   NOT NULL,
    window_end            TIMESTAMPTZ   NOT NULL,
    detection_timestamp   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT burst_events_window_order CHECK (window_end > window_start)
);

-- Index for topic-based lookups (most common prediction query)
CREATE INDEX IF NOT EXISTS idx_burst_events_topic_name
    ON burst_events (topic_name);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_burst_events_detection_timestamp
    ON burst_events (detection_timestamp DESC);

-- ---------------------------------------------------------------------------
-- trend_forecasts
-- ---------------------------------------------------------------------------
-- Records every Trend_Forecast produced by the Flink trend forecast operator.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trend_forecasts (
    forecast_id        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name         TEXT          NOT NULL,
    platform           TEXT          NOT NULL DEFAULT 'Unknown',
    predicted_volume   FLOAT         NOT NULL CHECK (predicted_volume >= 0.0),
    confidence_score   FLOAT         NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    avg_bias_score     FLOAT         CHECK (avg_bias_score IS NULL OR (avg_bias_score >= 0.0 AND avg_bias_score <= 1.0)),
    trend_direction    CHAR(1)       NOT NULL DEFAULT '→' CHECK (trend_direction IN ('↑', '↓', '→')),
    forecast_horizon   TIMESTAMPTZ   NOT NULL,
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for topic-based lookups
CREATE INDEX IF NOT EXISTS idx_trend_forecasts_topic_name
    ON trend_forecasts (topic_name);

-- Index for time-range queries on forecast horizon
CREATE INDEX IF NOT EXISTS idx_trend_forecasts_forecast_horizon
    ON trend_forecasts (forecast_horizon DESC);

-- ---------------------------------------------------------------------------
-- ws_event_log
-- ---------------------------------------------------------------------------
-- Audit log of every WebSocket event delivered by the API Gateway.
-- payload stores the full event JSON for replay / debugging.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ws_event_log (
    log_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   TEXT          NOT NULL,
    event_type   VARCHAR(64)   NOT NULL,
    payload      JSONB         NOT NULL DEFAULT '{}',
    delivered_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for session-based audit queries
CREATE INDEX IF NOT EXISTS idx_ws_event_log_session_id
    ON ws_event_log (session_id);

-- Index for time-range queries
CREATE INDEX IF NOT EXISTS idx_ws_event_log_delivered_at
    ON ws_event_log (delivered_at DESC);

-- Index for event-type filtering
CREATE INDEX IF NOT EXISTS idx_ws_event_log_event_type
    ON ws_event_log (event_type);

-- GIN index for JSONB payload queries (e.g. filtering by topic inside payload)
CREATE INDEX IF NOT EXISTS idx_ws_event_log_payload
    ON ws_event_log USING GIN (payload);

-- ---------------------------------------------------------------------------
-- trending_topics (view)
-- ---------------------------------------------------------------------------
-- Aggregates the most recent burst_event per topic+platform pair so the
-- API Gateway can serve a single /trending-topics endpoint without a
-- separate table. Falls back to trend_forecasts when no burst event exists.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW trending_topics AS
SELECT
    topic_name,
    platform,
    article_count                                          AS volume,
    avg_bias_score,
    trend_direction,
    CASE
        WHEN avg_bias_score IS NULL   THEN 'stable'
        WHEN avg_bias_score > 0.6     THEN 'critical'
        WHEN avg_bias_score > 0.3     THEN 'elevated'
        ELSE                               'stable'
    END                                                    AS risk_level,
    detection_timestamp                                    AS updated_at
FROM (
    SELECT
        topic_name,
        platform,
        article_count,
        avg_bias_score,
        trend_direction,
        detection_timestamp,
        ROW_NUMBER() OVER (
            PARTITION BY topic_name, platform
            ORDER BY detection_timestamp DESC
        ) AS rn
    FROM burst_events
) ranked
WHERE rn = 1

UNION ALL

-- Include topics that have forecasts but no burst event yet
SELECT
    tf.topic_name,
    tf.platform,
    CAST(tf.predicted_volume AS INT)                       AS volume,
    tf.avg_bias_score,
    tf.trend_direction,
    CASE
        WHEN tf.avg_bias_score IS NULL THEN 'stable'
        WHEN tf.avg_bias_score > 0.6   THEN 'critical'
        WHEN tf.avg_bias_score > 0.3   THEN 'elevated'
        ELSE                                'stable'
    END                                                    AS risk_level,
    tf.created_at                                          AS updated_at
FROM (
    SELECT
        topic_name,
        platform,
        predicted_volume,
        avg_bias_score,
        trend_direction,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY topic_name, platform
            ORDER BY created_at DESC
        ) AS rn
    FROM trend_forecasts
) tf_ranked
WHERE tf_ranked.rn = 1
  AND NOT EXISTS (
      SELECT 1 FROM burst_events be
      WHERE be.topic_name = tf_ranked.topic_name
        AND be.platform   = tf_ranked.platform
  );

-- ---------------------------------------------------------------------------
-- Migration guards: add new columns to existing tables if they don't exist.
-- Safe to run on a DB that was created before this schema version.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'burst_events' AND column_name = 'platform'
    ) THEN
        ALTER TABLE burst_events ADD COLUMN platform TEXT NOT NULL DEFAULT 'Unknown';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'burst_events' AND column_name = 'avg_bias_score'
    ) THEN
        ALTER TABLE burst_events ADD COLUMN avg_bias_score FLOAT
            CHECK (avg_bias_score IS NULL OR (avg_bias_score >= 0.0 AND avg_bias_score <= 1.0));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'burst_events' AND column_name = 'trend_direction'
    ) THEN
        ALTER TABLE burst_events ADD COLUMN trend_direction CHAR(1) NOT NULL DEFAULT '→';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trend_forecasts' AND column_name = 'platform'
    ) THEN
        ALTER TABLE trend_forecasts ADD COLUMN platform TEXT NOT NULL DEFAULT 'Unknown';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trend_forecasts' AND column_name = 'avg_bias_score'
    ) THEN
        ALTER TABLE trend_forecasts ADD COLUMN avg_bias_score FLOAT
            CHECK (avg_bias_score IS NULL OR (avg_bias_score >= 0.0 AND avg_bias_score <= 1.0));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trend_forecasts' AND column_name = 'trend_direction'
    ) THEN
        ALTER TABLE trend_forecasts ADD COLUMN trend_direction CHAR(1) NOT NULL DEFAULT '→';
    END IF;
END $$;
