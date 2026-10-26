from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..db import get_session
from ..models import Finding

router = APIRouter(prefix="/api/findings", tags=["findings"])


@router.get("", response_model=list[Finding])
def list_findings(
    case_id: str | None = None,
    evidence_id: str | None = None,
    session: Session = Depends(get_session),
) -> list[Finding]:
    stmt = select(Finding).order_by(Finding.timestamp.desc())
    if case_id:
        stmt = stmt.where(Finding.case_id == case_id)
    if evidence_id:
        stmt = stmt.where(Finding.evidence_id == evidence_id)
    return list(session.exec(stmt).all())
