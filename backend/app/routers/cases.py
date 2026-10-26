from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select
from ..db import get_session
from ..models import Case, CaseSummary, Evidence, Finding, TimelineEvent
from ..schemas import CaseCreate, CaseUpdate

router = APIRouter(prefix="/api/cases", tags=["cases"])



@router.get("", response_model=list[Case])
def list_cases(session: Session = Depends(get_session)) -> list[Case]:
    return list(session.exec(select(Case).order_by(Case.opened.desc())).all())





@router.get("/{case_id}", response_model=Case)
def get_case(case_id: str, session: Session = Depends(get_session)) -> Case:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    return case





@router.post("", response_model=Case, status_code=201)
def create_case(payload: CaseCreate, session: Session = Depends(get_session)) -> Case:
    case_id = payload.id.strip()
    if not case_id:
        raise HTTPException(422, "Case number cannot be empty")
    if session.get(Case, case_id) is not None:
        raise HTTPException(409, f"Case {case_id} already exists")



    case = Case(
            id=case_id,
            name=payload.name,
            investigator=payload.investigator,
            timezone=payload.timezone,
            priority=payload.priority,
            status=payload.status,
    )
    session.add(case)
    session.commit()
    session.refresh(case)
    return case





@router.patch("/{case_id}", response_model=Case)
def update_case(case_id: str, payload: CaseUpdate, session: Session = Depends(get_session)) -> Case:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if "name" in changes and not changes["name"].strip():
        raise HTTPException(422, "Case name cannot be empty")
    for key, value in changes.items():
        setattr(case, key, value)
    session.add(case)
    session.commit()
    session.refresh(case)
    return case





@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: str, session: Session = Depends(get_session)) -> None:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    evidence_count = session.exec(
        select(func.count()).select_from(Evidence).where(Evidence.case_id == case_id)
    ).one()
    if evidence_count:
        raise HTTPException(
            409,
            f"Case {case_id} still has {evidence_count} evidence item(s) attached — remove those first.",
        )

    summary = session.get(CaseSummary, case_id)
    if summary is not None:
        session.delete(summary)
    for finding in session.exec(select(Finding).where(Finding.case_id == case_id)).all():
        session.delete(finding)
    for event in session.exec(select(TimelineEvent).where(TimelineEvent.case_id == case_id)).all():
        session.delete(event)

    session.delete(case)
    session.commit()
