"""
FastAPI application entry-point for the analysis-service.
Satisfies Requirements 3.6, 3.7, 12.2, 12.6, 12.7
"""

from __future__ import annotations

import logging
import os
import threading
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.db.connection import close_pool, get_connection, release_connection
from app.kafka.consumer import AnalysisConsumer
from app.ml.bert_classifier import BertClassifier

# ---------------------------------------------------------------------------
# Standard logging — avoids LogRecord reserved-key conflicts
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("analysis-service")

# ---------------------------------------------------------------------------
# Singletons
# ---------------------------------------------------------------------------
_classifier: BertClassifier = BertClassifier()
_consumer: AnalysisConsumer | None = None
_consumer_thread: threading.Thread | None = None

_BERT_MODEL_PATH: str = os.environ.get("BERT_MODEL_PATH", "mock")
_KAFKA_BROKERS: str = os.environ.get("KAFKA_BROKERS", "localhost:9092")


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    global _consumer, _consumer_thread

    # 1. Load model
    logger.info("Loading model from '%s'", _BERT_MODEL_PATH)
    try:
        _classifier.load_model(_BERT_MODEL_PATH)
        logger.info("Model loaded (mock_mode=%s)", _classifier._mock_mode)
    except Exception as exc:
        logger.error("Failed to load model: %s\n%s", exc, traceback.format_exc())
        raise

    # 2. PostgreSQL check (non-fatal)
    try:
        conn = get_connection()
        release_connection(conn)
        logger.info("PostgreSQL connectivity verified")
    except Exception as exc:
        logger.warning("PostgreSQL check failed — degraded mode: %s", exc)

    # 3. Start Kafka consumer thread
    _consumer = AnalysisConsumer(classifier=_classifier, brokers=_KAFKA_BROKERS)
    _consumer_thread = threading.Thread(
        target=_consumer.start, daemon=True, name="kafka-consumer"
    )
    _consumer_thread.start()
    logger.info("Kafka consumer thread started (brokers=%s)", _KAFKA_BROKERS)

    # 4. Startup confirmation
    logger.info(
        "analysis-service started — model_loaded=%s kafka=%s",
        _classifier.is_loaded,
        _KAFKA_BROKERS,
    )

    yield

    # Shutdown
    logger.info("analysis-service shutting down")
    if _consumer is not None:
        _consumer.stop()
        if _consumer_thread is not None and _consumer_thread.is_alive():
            _consumer_thread.join(timeout=10)
    close_pool()
    logger.info("analysis-service shutdown complete")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="analysis-service",
    description="BERT-based caste-bias analysis microservice",
    version="1.0.0",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception on %s %s: %s\n%s",
        request.method,
        request.url,
        exc,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error_type": type(exc).__name__},
    )


@app.get("/health")
async def health() -> JSONResponse:
    model_loaded: bool = _classifier.is_loaded
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok" if model_loaded else "degraded",
            "service": "analysis-service",
            "model_loaded": model_loaded,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
