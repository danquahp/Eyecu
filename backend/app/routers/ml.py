from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, func, select

from ..db import get_session
from ..models import Evidence
from ..services import ml_classifier

router = APIRouter(prefix="/api/ml", tags=["ml"])


class LabelCounts(BaseModel):
    benign: int = 0
    suspicious: int = 0
    malicious: int = 0




class MLStatusOut(BaseModel):
    is_trained: bool
    labelled_counts: LabelCounts
    total_labelled: int
    n_training_examples: int | None = None
    classes: list[str] | None = None
    cv_f1_macro_mean: float | None = None
    cv_f1_macro_std: float | None = None
    feature_importances: dict[str, float] | None = None





class TrainOut(BaseModel):
    trained: bool
    message: str
    n_examples: int
    label_counts: dict[str, int]
    cv_f1_mean: float | None = None
    cv_f1_std: float | None = None




@router.get("/status", response_model=MLStatusOut)


def ml_status(session: Session = Depends(get_session)) -> MLStatusOut:
    rows = session.exec(
        select(Evidence.ground_truth_label, func.count(Evidence.id))
        .where(Evidence.ground_truth_label.is_not(None))
        .group_by(Evidence.ground_truth_label)
    ).all()
    counts = LabelCounts(**{label: count for label, count in rows})

    meta = ml_classifier.get_metadata()


    return MLStatusOut(
            is_trained=ml_classifier.is_trained(),
            labelled_counts=counts,
            total_labelled=sum(dict(rows).values()) if rows else 0,
            n_training_examples=meta.get("n_training_examples"),
            classes=meta.get("classes"),
            cv_f1_macro_mean=meta.get("cv_f1_macro_mean"),
            cv_f1_macro_std=meta.get("cv_f1_macro_std"),
            feature_importances=meta.get("feature_importances"),
    )




@router.post("/train", response_model=TrainOut)

def ml_train(session: Session = Depends(get_session)) -> TrainOut:
    from ml.train import train

    result = train(session)
    ml_classifier.invalidate_cache()
    return TrainOut(
     trained=result.trained,
     message=result.message,
     n_examples=result.n_examples,
     label_counts=result.label_counts or {},
     cv_f1_mean=result.cv_f1_mean,
     cv_f1_std=result.cv_f1_std,
    )
