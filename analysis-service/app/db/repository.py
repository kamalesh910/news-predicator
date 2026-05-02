"""
PostgreSQL repository for the analysis-service.

Persists analyzed article records to the `articles` and `bias_records` tables
defined in init-db/01_schema.sql.

Retry behaviour (Requirement 10.4):
  - Up to 3 retries on transient DB errors
  - Exponential backoff: wait_exponential(multiplier=1, min=1, max=10)
  - Structured JSON failure log after retry exhaustion

Satisfies Requirements 3.4, 10.1, 10.4
"""

import json
import logging
import traceback
from datetime import datetime, timezone

import psycopg2
from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.db.connection import get_connection, release_connection
from app.models.schemas import AnalyzedNewsMessage

# ---------------------------------------------------------------------------
# Structured JSON logger
# ---------------------------------------------------------------------------

_SERVICE_NAME = "analysis-service"


def _make_logger() -> logging.Logger:
    logger = logging.getLogger("analysis_service.db.repository")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger


_logger = _make_logger()


def _log(level: str, message: str, **extra) -> None:
    """Emit a structured JSON log entry."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": _SERVICE_NAME,
        "level": level,
        "message": message,
        **extra,
    }
    getattr(_logger, level, _logger.info)(json.dumps(entry))


# ---------------------------------------------------------------------------
# Internal write helper (decorated with retry)
# ---------------------------------------------------------------------------

@retry(
    retry=retry_if_exception_type(psycopg2.Error),
    stop=stop_after_attempt(4),          # 1 original attempt + 3 retries
    wait=wait_exponential(multiplier=1, min=1, max=10),
    reraise=True,
)
def _write_record(record: AnalyzedNewsMessage) -> None:
    """
    Perform the actual INSERT operations inside a single transaction.

    Raises:
        psycopg2.Error: on any database error (triggers tenacity retry).
    """
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # ----------------------------------------------------------
                # 1. Insert into articles
                # ----------------------------------------------------------
                cur.execute(
                    """
                    INSERT INTO articles (
                        article_id,
                        source_url,
                        title,
                        body,
                        source_name,
                        published_at,
                        schema_version
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (article_id) DO NOTHING
                    """,
                    (
                        record.articleId,
                        record.sourceUrl,
                        record.title,
                        record.body,
                        record.sourceName,
                        record.publishedAt,
                        record.schemaVersion,
                    ),
                )

                # ----------------------------------------------------------
                # 2. Insert into bias_records
                # ----------------------------------------------------------
                cur.execute(
                    """
                    INSERT INTO bias_records (
                        article_id,
                        bias_score,
                        bias_label,
                        analysis_timestamp,
                        error_flag
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        record.articleId,
                        record.biasScore,
                        record.biasLabel,
                        record.analysisTimestamp,
                        record.errorFlag,
                    ),
                )
    finally:
        release_connection(conn)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_analyzed_article(record: AnalyzedNewsMessage) -> None:
    """
    Persist an analyzed article to PostgreSQL.

    Inserts one row into `articles` and one row into `bias_records`.
    Retries up to 3 times with exponential backoff on transient DB errors.
    Logs a structured JSON error entry if all retries are exhausted.

    Args:
        record: The analyzed article to persist.

    Raises:
        psycopg2.Error: re-raised after retry exhaustion so the caller can
                        decide whether to drop or dead-letter the message.
    """
    try:
        _write_record(record)
        _log(
            "info",
            "Analyzed article persisted",
            article_id=record.articleId,
        )
    except (RetryError, psycopg2.Error) as exc:
        # Unwrap RetryError to get the underlying psycopg2 exception
        cause = exc.last_attempt.exception() if isinstance(exc, RetryError) else exc
        _log(
            "error",
            "Persistent database write failure after retries",
            article_id=record.articleId,
            error_type=type(cause).__name__,
            error_message=str(cause),
            stack_trace=traceback.format_exc(),
        )
        raise cause from exc
