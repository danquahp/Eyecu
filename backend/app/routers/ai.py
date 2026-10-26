from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import get_session
from ..models import Case, CaseSummary, Evidence, Finding, TimelineEvent, utcnow
from ..services import llm

router = APIRouter(prefix="/api/cases", tags=["ai"])




class SummaryOut(BaseModel):
    case_id: str
    content: str
    model: str
    generated_at: datetime


class LLMStatusOut(BaseModel):
    available: bool
    model: str


@router.get("/ai/status", response_model=LLMStatusOut)
async def llm_status() -> LLMStatusOut:
    return LLMStatusOut(available=await llm.is_available(), model=llm.MODEL)



@router.get("/{case_id}/summary", response_model=SummaryOut | None)


def get_summary(case_id: str, session: Session = Depends(get_session)) -> CaseSummary | None:
    return session.get(CaseSummary, case_id)




@router.post("/{case_id}/summary", response_model=SummaryOut)
async def generate_summary(case_id: str, session: Session = Depends(get_session)) -> CaseSummary:
    case = session.get(Case, case_id)
    if case is None:
        raise HTTPException(404, "Case not found")

    if not await llm.is_available():
        raise HTTPException(
            503,
            f"Local model '{llm.MODEL}' isn't reachable on Ollama, check the server is running and the model is pulled",
        )



    evidence = session.exec(select(Evidence).where(Evidence.case_id == case_id)).all()
    findings = session.exec(select(Finding).where(Finding.case_id == case_id)).all()
    timeline = session.exec(select(TimelineEvent).where(TimelineEvent.case_id == case_id)).all()



    if not evidence:
        raise HTTPException(400, "nothing to summarise.")

    try:
        content = await llm.generate_case_narrative(case, evidence, findings, timeline)
    except Exception as exc: 
        raise HTTPException(502, f"Local model call failed: {exc}") from exc

    summary = session.get(CaseSummary, case_id)
    if summary is None:
        summary = CaseSummary(case_id=case_id, content=content, model=llm.MODEL)
    else:
        summary.content = content
        summary.model = llm.MODEL
        summary.generated_at = utcnow()
    session.add(summary)
    session.commit()
    session.refresh(summary)
    return summary
