from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import Job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[Job])
def list_jobs(evidence_id: str | None = None, session: Session = Depends(get_session)) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc())
    if evidence_id:
        stmt = stmt.where(Job.evidence_id == evidence_id)
    return list(session.exec(stmt).all())
