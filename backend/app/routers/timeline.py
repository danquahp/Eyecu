from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import TimelineEvent

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=list[TimelineEvent])
def list_timeline(case_id: str | None = None, session: Session = Depends(get_session)) -> list[TimelineEvent]:
    stmt = select(TimelineEvent).order_by(TimelineEvent.time.asc())
    if case_id:
        stmt = stmt.where(TimelineEvent.case_id == case_id)
    return list(session.exec(stmt).all())
