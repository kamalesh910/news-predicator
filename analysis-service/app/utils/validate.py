"""
Field validation helpers for the analysis-service.

Satisfies Requirements 3.2, 3.3, 4.1, 4.2, 4.3
"""

from app.models.schemas import RawNewsMessage


# Required fields that must be present and non-empty in a raw message dict
_REQUIRED_RAW_FIELDS = (
    "articleId",
    "sourceUrl",
    "title",
    "body",
    "sourceName",
    "publishedAt",
    "schemaVersion",
)


def validate_raw_message(data: dict) -> RawNewsMessage:
    """
    Validate a raw dict against the RawNewsMessage schema.

    Raises:
        ValueError: if any required field is missing or empty.

    Returns:
        A validated RawNewsMessage instance.
    """
    if not isinstance(data, dict):
        raise ValueError(f"Expected a dict, got {type(data).__name__}")

    missing = [field for field in _REQUIRED_RAW_FIELDS if not data.get(field)]
    if missing:
        raise ValueError(
            f"RawNewsMessage is missing or has empty required fields: {missing}"
        )

    # Delegate remaining validation (type coercion, extra-field handling) to Pydantic
    return RawNewsMessage(**data)


def validate_bias_score(score: float) -> float:
    """
    Validate that a bias score is a valid probability in [0.0, 1.0].

    Raises:
        ValueError: if score is outside the closed interval [0.0, 1.0].

    Returns:
        The validated score unchanged.
    """
    if not isinstance(score, (int, float)):
        raise ValueError(
            f"Bias score must be a numeric value, got {type(score).__name__}"
        )

    if score < 0.0 or score > 1.0:
        raise ValueError(
            f"Bias score must be in [0.0, 1.0], got {score}"
        )

    return float(score)
