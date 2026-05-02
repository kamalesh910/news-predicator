"""
Structured JSON logger for the analysis-service.

Provides a `get_logger` factory that returns a :class:`logging.Logger`
configured with a JSON formatter.  Every log record emits a JSON object
containing at minimum:

    {
        "timestamp": "<ISO 8601>",
        "service":   "analysis-service",
        "level":     "<DEBUG|INFO|WARNING|ERROR|CRITICAL>",
        "message":   "<log message>"
    }

Any keyword arguments passed to the logger via the ``extra`` dict are
merged into the top-level JSON object.

Satisfies Requirements 12.6, 12.7
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

_SERVICE_NAME = "analysis-service"


class _JsonFormatter(logging.Formatter):
    """
    Logging formatter that serialises each :class:`logging.LogRecord` as a
    single-line JSON string.

    Standard fields emitted for every record:
        - ``timestamp``  — UTC ISO 8601 string
        - ``service``    — always ``"analysis-service"``
        - ``level``      — record level name (e.g. ``"INFO"``)
        - ``message``    — formatted log message

    Optional fields (present only when the record carries them):
        - ``exc_info``   — formatted exception traceback (when an exception
                           is attached to the record)
        - Any extra keys injected via ``logging.Logger.info(..., extra={...})``
    """

    # Keys that are part of the standard LogRecord and should NOT be
    # forwarded as extra fields to avoid noise.
    _SKIP_KEYS = frozenset(
        {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
            "message",
            "taskName",
            "asctime",
        }
    )

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        # Ensure record.message is populated
        record.message = record.getMessage()

        entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": _SERVICE_NAME,
            "level": record.levelname,
            "message": record.message,
        }

        # Attach exception info when present
        if record.exc_info:
            entry["exc_info"] = self.formatException(record.exc_info)
        elif record.exc_text:
            entry["exc_info"] = record.exc_text

        # Forward any extra fields injected by the caller
        for key, value in record.__dict__.items():
            if key not in self._SKIP_KEYS and not key.startswith('_'):
                entry[key] = value

        return json.dumps(entry, default=str)


def get_logger(name: str) -> logging.Logger:
    """
    Return a :class:`logging.Logger` configured with JSON formatting.

    If a logger with *name* already has handlers attached (e.g. because it
    was previously configured), it is returned as-is to avoid duplicate
    output.

    Args:
        name: Logger name, typically ``__name__`` of the calling module.

    Returns:
        A :class:`logging.Logger` that emits structured JSON to *stderr*
        via a :class:`logging.StreamHandler`.

    Example::

        logger = get_logger(__name__)
        logger.info("Service started", extra={"port": 8000})
        # → {"timestamp": "...", "service": "analysis-service",
        #    "level": "INFO", "message": "Service started", "port": 8000}
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(_JsonFormatter())
        logger.addHandler(handler)
        logger.propagate = False

    if logger.level == logging.NOTSET:
        logger.setLevel(logging.INFO)

    return logger
