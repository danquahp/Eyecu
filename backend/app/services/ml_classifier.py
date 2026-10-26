from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd

from ..adapters.base import FindingDraft
from ..models import Evidence, Finding, FindingType, Job, Severity

_MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "ml" / "models"
_MODEL_PATH = _MODEL_DIR / "classifier.joblib"
_META_PATH = _MODEL_DIR / "metadata.json"

_model = None
_feature_names: list[str] | None = None


def is_trained() -> bool:
    return _MODEL_PATH.exists() and _META_PATH.exists()



def get_metadata() -> dict:


    if not _META_PATH.exists():
        return {}
    return json.loads(_META_PATH.read_text())





def invalidate_cache() -> None:
    global _model
    _model = None
def _load():
    global _model, _feature_names
    if _model is None:
        from ml.features import FEATURE_NAMES 

        _model = joblib.load(_MODEL_PATH)
        _feature_names = json.loads(_META_PATH.read_text())["feature_names"] or FEATURE_NAMES
    return _model, _feature_names




def score_evidence(evidence: Evidence, jobs: list[Job], findings: list[Finding]) -> FindingDraft | None:
#Runs the trained classifier over one evidence item's own findings. Returns None if no model has been trained yet

    if not is_trained():
        return None

    from ml.features import extract_features

    model, feature_names = _load()
    features = extract_features(evidence, jobs, findings)
    row = pd.DataFrame([{name: features.get(name, 0) for name in feature_names}])

    proba = model.predict_proba(row)[0]
    classes = list(model.classes_)
    top_idx = proba.argmax()
    label = classes[top_idx]
    confidence = round(float(proba[top_idx]) * 100)


    if label == "benign":
        return None


    severity = Severity.HIGH if label == "malicious" else Severity.MEDIUM
    return FindingDraft(
        type=FindingType.CORRELATION,
        description=(
            f"ML classifier (trained on {_training_size()} labelled examples) predicts this "
            f"evidence is '{label}' with {confidence}% confidence, based on the combined "
            f"signal from all tools that ran against it."
        ),
        confidence=confidence,
        severity=severity,
    )


def _training_size() -> int:
    try:
        return json.loads(_META_PATH.read_text())["n_training_examples"]
    except Exception:
        return 0
