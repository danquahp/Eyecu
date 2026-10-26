#Trains the evidence classifier from whatever labelled evidence is currently in the database.


from __future__ import annotations
import json
import sys
from dataclasses import dataclass
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score
from sqlmodel import Session, select
from app.db import engine
from app.models import Evidence, Finding, Job
from ml.features import FEATURE_NAMES, extract_features




MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "classifier.joblib"
META_PATH = MODEL_DIR / "metadata.json"

MIN_EXAMPLES = 20





@dataclass
class TrainResult:
    trained: bool
    message: str
    n_examples: int = 0
    label_counts: dict[str, int] | None = None
    cv_f1_mean: float | None = None
    cv_f1_std: float | None = None





def build_training_table(session: Session) -> pd.DataFrame:
    labelled = session.exec(select(Evidence).where(Evidence.ground_truth_label.is_not(None))).all()

    rows = []
    for evidence in labelled:
        jobs = session.exec(select(Job).where(Job.evidence_id == evidence.id)).all()
        findings = session.exec(select(Finding).where(Finding.evidence_id == evidence.id)).all()
        features = extract_features(evidence, jobs, findings)
        features["label"] = evidence.ground_truth_label
        features["evidence_id"] = evidence.id
        rows.append(features)

    return pd.DataFrame(rows)





def train(session: Session) -> TrainResult:
    df = build_training_table(session)
    label_counts = df["label"].value_counts().to_dict() if len(df) else {}

    if len(df) < MIN_EXAMPLES:
        return TrainResult(
            trained=False,
            message=(
                f"Need at least {MIN_EXAMPLES} labelled examples to train (have {len(df)}). "
                "Ingest more evidence and set its Training Label first."
            ),
            n_examples=len(df),
            label_counts=label_counts,
        )

    # Cross-validation needs at least 2 examples of every class it trains

    counts = df["label"].value_counts()
    too_rare = counts[counts < 2].index.tolist()
    note = ""
    if too_rare:
        note = f" (ignored label(s) with <2 examples: {', '.join(too_rare)})"
        df = df[~df["label"].isin(too_rare)]



    if df["label"].nunique() < 2:
        return TrainResult(
            trained=False,
            message=(
                f"Only one usable label remains after dropping under-represented ones{note} — "
                "need at least two classes with 2+ examples each."
            ),
            n_examples=len(df),
            label_counts=label_counts,
        )

    X = df[FEATURE_NAMES]
    y = df["label"]

    clf = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, class_weight="balanced")
    scores = cross_val_score(clf, X, y, cv=min(5, y.value_counts().min()), scoring="f1_macro")
    clf.fit(X, y)

    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(clf, MODEL_PATH)
    META_PATH.write_text(
        json.dumps(
            {
                "feature_names": FEATURE_NAMES,
                "classes": list(clf.classes_),
                "n_training_examples": len(df),
                "cv_f1_macro_mean": scores.mean(),
                "cv_f1_macro_std": scores.std(),
                "feature_importances": dict(zip(FEATURE_NAMES, clf.feature_importances_.tolist())),
            },
            indent=2,
        )
    )

    return TrainResult(
        trained=True,
        message=f"Trained on {len(df)} labelled examples{note}. Model saved to {MODEL_PATH.name}.",
        n_examples=len(df),
        label_counts=label_counts,
        cv_f1_mean=float(scores.mean()),
        cv_f1_std=float(scores.std()),
    )


def main() -> None:
    with Session(engine) as session:
        result = train(session)
    print(result.message)
    if result.trained:
        print(f"Cross-validated F1 (macro): {result.cv_f1_mean:.3f} ± {result.cv_f1_std:.3f}")


if __name__ == "__main__":
    main()
