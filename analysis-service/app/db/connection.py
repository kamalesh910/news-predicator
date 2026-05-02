"""
PostgreSQL connection pool management for the analysis-service.

Configurable via environment variables:
  POSTGRES_HOST     — database host (default: localhost)
  POSTGRES_PORT     — database port (default: 5432)
  POSTGRES_DB       — database name (default: newsdb)
  POSTGRES_USER     — database user (default: postgres)
  POSTGRES_PASSWORD — database password (default: postgres)

Satisfies Requirements 3.4, 10.1, 10.4
"""

import json
import logging
import os
from datetime import datetime, timezone

import psycopg2
from psycopg2.pool import ThreadedConnectionPool

# ---------------------------------------------------------------------------
# Structured JSON logger
# ---------------------------------------------------------------------------

_SERVICE_NAME = "analysis-service"


def _make_logger() -> logging.Logger:
    logger = logging.getLogger("analysis_service.db.connection")
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
    _logger.info(json.dumps(entry))


# ---------------------------------------------------------------------------
# Connection pool
# ---------------------------------------------------------------------------

_pool: ThreadedConnectionPool | None = None

# Pool size bounds
_MIN_CONN = int(os.environ.get("POSTGRES_POOL_MIN", "1"))
_MAX_CONN = int(os.environ.get("POSTGRES_POOL_MAX", "10"))


def _build_dsn() -> str:
    """Construct a libpq DSN from environment variables."""
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    dbname = os.environ.get("POSTGRES_DB", "newsdb")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "postgres")
    return (
        f"host={host} port={port} dbname={dbname} "
        f"user={user} password={password}"
    )


def _get_pool() -> ThreadedConnectionPool:
    """Return the singleton connection pool, initialising it on first call."""
    global _pool
    if _pool is None or _pool.closed:
        dsn = _build_dsn()
        _pool = ThreadedConnectionPool(_MIN_CONN, _MAX_CONN, dsn=dsn)
        _log(
            "info",
            "PostgreSQL connection pool initialised",
            min_connections=_MIN_CONN,
            max_connections=_MAX_CONN,
        )
    return _pool


def get_connection() -> psycopg2.extensions.connection:
    """
    Borrow a connection from the pool.

    Returns:
        An open psycopg2 connection.

    Raises:
        psycopg2.pool.PoolError: if no connection is available.
    """
    return _get_pool().getconn()


def release_connection(conn: psycopg2.extensions.connection) -> None:
    """
    Return a connection to the pool.

    If the connection is in a failed transaction state it is rolled back
    before being returned so the next caller receives a clean connection.

    Args:
        conn: The connection to release.
    """
    if conn is None:
        return
    try:
        if conn.status == psycopg2.extensions.STATUS_IN_TRANSACTION:
            conn.rollback()
    except Exception:
        pass
    _get_pool().putconn(conn)


def close_pool() -> None:
    """
    Close all connections in the pool for graceful shutdown.

    Safe to call even if the pool was never initialised.
    """
    global _pool
    if _pool is not None and not _pool.closed:
        _pool.closeall()
        _log("info", "PostgreSQL connection pool closed")
    _pool = None
