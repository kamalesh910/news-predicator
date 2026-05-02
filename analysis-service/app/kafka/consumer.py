"""
Kafka consumer and producer for the analysis pipeline.

Consumes raw news articles from the `raw-news` topic, runs BERT inference,
and publishes annotated results to the `analyzed-news` topic.

Satisfies Requirements 3.1, 3.3, 3.5, 11.2
"""

from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from typing import List, Optional

from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import KafkaError

from app.ml.bert_classifier import BertClassifier
from app.models.schemas import AnalyzedNewsMessage, RawNewsMessage
from app.utils.validate import validate_raw_message

logger = logging.getLogger(__name__)


class AnalysisConsumer:
    """
    Kafka consumer/producer pair for the analysis pipeline.

    Reads from the ``raw-news`` topic, runs BERT caste-bias inference via
    :class:`~app.ml.bert_classifier.BertClassifier`, and publishes the
    annotated result to the ``analyzed-news`` topic.

    On inference failure the article is still published with
    ``biasScore=None`` and ``errorFlag=True`` so no message is ever dropped
    (Requirement 3.5).

    Usage::

        classifier = BertClassifier()
        classifier.load_model("/path/to/model")

        consumer = AnalysisConsumer(classifier=classifier)
        consumer.start()   # blocks; call stop() from another thread to exit

    Args:
        classifier: A pre-loaded :class:`BertClassifier` instance.
        brokers: Kafka broker address(es).
        input_topic: Topic to consume raw articles from.
        output_topic: Topic to publish analyzed articles to.
        group_id: Kafka consumer group identifier.
        auto_offset_reset: Where to start consuming when no committed offset
            exists (``"earliest"`` or ``"latest"``).
    """

    def __init__(
        self,
        classifier: BertClassifier,
        brokers: List[str] | str = "localhost:9092",
        input_topic: str = "raw-news",
        output_topic: str = "analyzed-news",
        group_id: str = "analysis-service",
        auto_offset_reset: str = "earliest",
    ) -> None:
        self._classifier = classifier
        self._brokers = [brokers] if isinstance(brokers, str) else brokers
        self._input_topic = input_topic
        self._output_topic = output_topic
        self._group_id = group_id
        self._auto_offset_reset = auto_offset_reset

        self._running = False
        self._stop_event = threading.Event()

        self._consumer: Optional[KafkaConsumer] = None
        self._producer: Optional[KafkaProducer] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self) -> None:
        """
        Begin consuming messages from ``raw-news`` in a blocking loop.

        Call :meth:`stop` from another thread to exit gracefully.
        """
        self._running = True
        self._stop_event.clear()

        logger.info(
            json.dumps(
                {
                    "event": "consumer_starting",
                    "service": "analysis-service",
                    "input_topic": self._input_topic,
                    "output_topic": self._output_topic,
                    "group_id": self._group_id,
                    "brokers": self._brokers,
                }
            )
        )

        self._consumer = KafkaConsumer(
            self._input_topic,
            bootstrap_servers=self._brokers,
            group_id=self._group_id,
            auto_offset_reset=self._auto_offset_reset,
            enable_auto_commit=True,
            value_deserializer=None,  # raw bytes; we handle JSON ourselves
        )

        self._producer = KafkaProducer(
            bootstrap_servers=self._brokers,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            acks="all",
            retries=3,
        )

        logger.info(
            json.dumps(
                {
                    "event": "consumer_started",
                    "service": "analysis-service",
                    "input_topic": self._input_topic,
                }
            )
        )

        try:
            for message in self._consumer:
                if self._stop_event.is_set():
                    break
                self._handle_message(message)
        finally:
            self._shutdown()

    def stop(self) -> None:
        """Signal the consume loop to exit and release resources."""
        logger.info(
            json.dumps(
                {
                    "event": "consumer_stopping",
                    "service": "analysis-service",
                }
            )
        )
        self._stop_event.set()
        self._running = False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _handle_message(self, message) -> None:
        """Process a single Kafka message end-to-end."""
        raw_bytes: bytes = message.value

        # --- 1. Deserialize JSON ---
        try:
            data: dict = json.loads(raw_bytes.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            logger.error(
                json.dumps(
                    {
                        "event": "deserialization_error",
                        "service": "analysis-service",
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "topic": message.topic,
                        "partition": message.partition,
                        "offset": message.offset,
                    }
                )
            )
            # Skip malformed messages — cannot recover without the original data
            return

        # --- 2. Validate required fields ---
        try:
            raw_msg: RawNewsMessage = validate_raw_message(data)
        except (ValueError, Exception) as exc:
            logger.error(
                json.dumps(
                    {
                        "event": "validation_error",
                        "service": "analysis-service",
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "article_id": data.get("articleId", "<unknown>"),
                    }
                )
            )
            # Skip messages that fail schema validation
            return

        # --- 3. Run BERT inference ---
        bias_score: Optional[float] = None
        bias_label: str = "unknown"
        error_flag: bool = False

        try:
            bias_score, bias_label = self._classifier.predict(raw_msg.body)
        except Exception as exc:
            error_flag = True
            logger.error(
                json.dumps(
                    {
                        "event": "inference_error",
                        "service": "analysis-service",
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "article_id": raw_msg.articleId,
                    }
                )
            )
            # Requirement 3.5: publish with errorFlag=True rather than dropping

        # --- 4. Build analyzed message ---
        analysis_timestamp = datetime.now(timezone.utc).isoformat()

        analyzed = AnalyzedNewsMessage(
            articleId=raw_msg.articleId,
            sourceUrl=raw_msg.sourceUrl,
            title=raw_msg.title,
            body=raw_msg.body,
            sourceName=raw_msg.sourceName,
            publishedAt=raw_msg.publishedAt,
            schemaVersion=raw_msg.schemaVersion,
            biasScore=bias_score,
            biasLabel=bias_label,
            analysisTimestamp=analysis_timestamp,
            errorFlag=error_flag,
        )

        # --- 5. Publish to analyzed-news ---
        self._publish(analyzed)

    def _publish(self, analyzed: AnalyzedNewsMessage) -> None:
        """Serialize and publish an :class:`AnalyzedNewsMessage` to Kafka."""
        payload = analyzed.model_dump()

        try:
            future = self._producer.send(self._output_topic, value=payload)
            future.get(timeout=10)  # block until broker acknowledges

            logger.info(
                json.dumps(
                    {
                        "event": "message_published",
                        "service": "analysis-service",
                        "topic": self._output_topic,
                        "article_id": analyzed.articleId,
                        "bias_score": analyzed.biasScore,
                        "error_flag": analyzed.errorFlag,
                    }
                )
            )
        except KafkaError as exc:
            logger.error(
                json.dumps(
                    {
                        "event": "publish_error",
                        "service": "analysis-service",
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "article_id": analyzed.articleId,
                        "topic": self._output_topic,
                    }
                )
            )

    def _shutdown(self) -> None:
        """Close Kafka consumer and producer connections."""
        if self._consumer is not None:
            try:
                self._consumer.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    json.dumps(
                        {
                            "event": "consumer_close_error",
                            "service": "analysis-service",
                            "error_type": type(exc).__name__,
                            "error_message": str(exc),
                        }
                    )
                )
            finally:
                self._consumer = None

        if self._producer is not None:
            try:
                self._producer.flush()
                self._producer.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    json.dumps(
                        {
                            "event": "producer_close_error",
                            "service": "analysis-service",
                            "error_type": type(exc).__name__,
                            "error_message": str(exc),
                        }
                    )
                )
            finally:
                self._producer = None

        logger.info(
            json.dumps(
                {
                    "event": "consumer_stopped",
                    "service": "analysis-service",
                }
            )
        )
