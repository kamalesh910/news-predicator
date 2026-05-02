"""
BERT inference module for caste-bias classification.

When BERT_MODEL_PATH is set to 'mock' or is unavailable, falls back to a
fast keyword-based scorer so the pipeline works without downloading a model.

Satisfies Requirements 3.1, 3.2, 3.7
"""

from __future__ import annotations

import hashlib
import logging

logger = logging.getLogger(__name__)

# Binary classification labels
_LABELS = {0: "neutral", 1: "biased"}

# Keywords that raise the bias score (simple heuristic for demo/testing)
_BIAS_KEYWORDS = [
    "caste", "discrimination", "bias", "prejudice", "oppression",
    "inequality", "marginalized", "suppressed", "targeted", "profiling",
]


class BertClassifier:
    """
    Wraps a HuggingFace BERT model for binary caste-bias classification.
    Falls back to a fast keyword heuristic when the model path is 'mock'
    or when transformers/torch are unavailable.
    """

    def __init__(self) -> None:
        self._tokenizer = None
        self._model = None
        self._mock_mode: bool = False

    @property
    def is_loaded(self) -> bool:
        return self._mock_mode or (self._tokenizer is not None and self._model is not None)

    def load_model(self, model_path: str) -> None:
        """
        Load the model. If model_path is 'mock' or loading fails,
        falls back to keyword-based scoring automatically.
        """
        if model_path.lower() == "mock":
            self._mock_mode = True
            logger.info("BertClassifier: running in MOCK mode (keyword heuristic)")
            return

        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification

            logger.info(f"BertClassifier: loading model from '{model_path}'")
            self._tokenizer = AutoTokenizer.from_pretrained(model_path)
            self._model = AutoModelForSequenceClassification.from_pretrained(
                model_path, num_labels=2
            )
            self._model.eval()
            self._model.to(torch.device("cpu"))
            logger.info("BertClassifier: model loaded successfully")

        except Exception as exc:
            logger.warning(
                f"BertClassifier: could not load model '{model_path}' ({exc}). "
                "Falling back to keyword heuristic (mock mode)."
            )
            self._mock_mode = True

    def predict(self, text: str) -> tuple[float, str]:
        """
        Run caste-bias inference on text.
        Returns (bias_score, label) where bias_score is in [0.0, 1.0].
        """
        if not self.is_loaded:
            raise RuntimeError(
                "BertClassifier: model is not loaded. "
                "Call load_model(model_path) before calling predict()."
            )

        if self._mock_mode:
            return self._mock_predict(text)

        import torch
        import torch.nn.functional as F

        inputs = self._tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
            max_length=512,
        )

        with torch.no_grad():
            outputs = self._model(**inputs)

        probabilities = F.softmax(outputs.logits, dim=-1)
        bias_score: float = probabilities[0, 1].item()
        predicted_class: int = int(torch.argmax(probabilities, dim=-1).item())
        label: str = _LABELS[predicted_class]
        return bias_score, label

    def _mock_predict(self, text: str) -> tuple[float, str]:
        """
        Fast keyword-based bias scorer for demo/testing.
        Produces deterministic but varied scores based on text content.
        """
        text_lower = text.lower()

        # Count bias keyword hits
        hits = sum(1 for kw in _BIAS_KEYWORDS if kw in text_lower)

        # Base score from keyword density
        base_score = min(0.9, hits * 0.15)

        # Add deterministic variation from text hash so different articles
        # get different scores even without keywords
        text_hash = int(hashlib.md5(text.encode()).hexdigest()[:4], 16)
        variation = (text_hash % 100) / 1000.0  # 0.000 – 0.099

        bias_score = round(min(1.0, base_score + variation + 0.05), 3)
        label = "biased" if bias_score >= 0.5 else "neutral"
        return bias_score, label
