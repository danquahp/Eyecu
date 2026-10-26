import hashlib
from datetime import datetime
from pathlib import Path
from uuid import uuid4
import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlmodel import Session, select

from ..config import EVIDENCE_DIR, UPLOAD_CHUNK_BYTES
from ..db import get_session
from ..models import (
    Case,
    Evidence,
    EvidenceStatus,
    EvidenceSummary,
    EvidenceType,
    Finding,
    Job,
    JobStatus,
    ToolName,
    utcnow,
)
from ..schemas import EvidenceOut, LabelUpdate
from ..services import llm
from ..services.browse import TimelineEntry, extract_timeline
from ..services.jobs import enqueue_job

_TIMELINE_TYPES = {EvidenceType.DISK_IMAGE, EvidenceType.MOBILE_EXTRACTION}

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


class EvidenceSummaryOut(BaseModel):
    evidence_id: str
    content: str
    model: str
    generated_at: datetime




def _to_out(session: Session, items: list[Evidence]) -> list[EvidenceOut]:
    if not items:
        return []
    ids = [e.id for e in items]
    jobs = session.exec(select(Job).where(Job.evidence_id.in_(ids))).all()
    tools_by_evidence: dict[str, list[ToolName]] = {}
    for job in jobs:
        tools_by_evidence.setdefault(job.evidence_id, [])
        if job.tool not in tools_by_evidence[job.evidence_id]:
            tools_by_evidence[job.evidence_id].append(job.tool)
    return [
        EvidenceOut(**item.model_dump(), tools=tools_by_evidence.get(item.id, []))
        for item in items
    ]




@router.get("", response_model=list[EvidenceOut])
def list_evidence(case_id: str | None = None, session: Session = Depends(get_session)) -> list[EvidenceOut]:
    stmt = select(Evidence).order_by(Evidence.ingested.desc())
    if case_id:
        stmt = stmt.where(Evidence.case_id == case_id)
    return _to_out(session, list(session.exec(stmt).all()))




@router.get("/{evidence_id}", response_model=EvidenceOut)
def get_evidence(evidence_id: str, session: Session = Depends(get_session)) -> EvidenceOut:
    item = session.get(Evidence, evidence_id)
    
    
    if item is None:
        raise HTTPException(404, "Evidence not found")
    return _to_out(session, [item])[0]





@router.post("", response_model=EvidenceOut, status_code=201)
async def ingest_evidence(
    case_id: str = Form(...),
    type: EvidenceType = Form(...),
    tools: list[ToolName] = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> EvidenceOut:
    
    case = session.get(Case, case_id)




    if case is None:
        raise HTTPException(404, f"Case {case_id} does not exist")
    if not tools:
        raise HTTPException(400, "Select at least one tool to run")



    # Every disk image gets Bulk extractor USB history automatically 
    if type == EvidenceType.DISK_IMAGE:
        for auto_tool in (ToolName.BULK_EXTRACTOR, ToolName.USB_HISTORY):
            if auto_tool not in tools:
                tools = [*tools, auto_tool]



    evidence_id = f"EV-{uuid4().hex[:6].upper()}"
    dest_dir = EVIDENCE_DIR / case_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / f"{evidence_id}_{file.filename}"



    hasher = hashlib.sha256()
    size_bytes = 0
    async with aiofiles.open(dest_path, "wb") as out:
        while chunk := await file.read(UPLOAD_CHUNK_BYTES):
            hasher.update(chunk)
            size_bytes += len(chunk)
            await out.write(chunk)



    evidence = Evidence(
        id=evidence_id,
        name=file.filename or evidence_id,
        case_id=case_id,
        type=type,
        size_bytes=size_bytes,
        status=EvidenceStatus.QUEUED,
        sha256=hasher.hexdigest(),
        stored_path=str(dest_path),
    )
    session.add(evidence)
    session.commit()



    job_ids: list[int] = []
    for tool in dict.fromkeys(tools):
        job = Job(evidence_id=evidence_id, tool=tool, status=JobStatus.QUEUED)
        session.add(job)
        session.commit()
        session.refresh(job)
        job_ids.append(job.id)

    for job_id in job_ids:
        enqueue_job(job_id)

    session.refresh(evidence)
    return _to_out(session, [evidence])[0]




@router.patch("/{evidence_id}/label", response_model=EvidenceOut)
def set_label(evidence_id: str, payload: LabelUpdate, session: Session = Depends(get_session)) -> EvidenceOut:
    evidence = session.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(404, "Evidence not found")
    evidence.ground_truth_label = payload.ground_truth_label
    session.add(evidence)
    session.commit()
    session.refresh(evidence)
    return _to_out(session, [evidence])[0]


@router.get("/{evidence_id}/summary", response_model=EvidenceSummaryOut | None)
def get_evidence_summary(evidence_id: str, session: Session = Depends(get_session)) -> EvidenceSummary | None:
    return session.get(EvidenceSummary, evidence_id)


@router.post("/{evidence_id}/summary", response_model=EvidenceSummaryOut)
async def generate_evidence_summary(evidence_id: str, session: Session = Depends(get_session)) -> EvidenceSummary:
    evidence = session.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(404, "Evidence not found")

    if not await llm.is_available():
        raise HTTPException(
            503,
            f"Local model '{llm.MODEL}' isn't reachable on Ollama — check the server is running and the model is pulled.",
        )

    jobs = session.exec(select(Job).where(Job.evidence_id == evidence_id)).all()
    findings = session.exec(select(Finding).where(Finding.evidence_id == evidence_id)).all()

    if not jobs:
        raise HTTPException(400, "This evidence has no completed tool runs yet — nothing to summarise.")

    timeline: list[TimelineEntry] | None = None
    if evidence.type in _TIMELINE_TYPES:
        try:
            timeline = extract_timeline(Path(evidence.stored_path))
        except RuntimeError:
            timeline = None 

    try:
        content = await llm.generate_evidence_narrative(evidence, jobs, findings, timeline)
    except Exception as exc:  
        raise HTTPException(502, f"Local model call failed: {exc}") from exc

    summary = session.get(EvidenceSummary, evidence_id)

    
    if summary is None:
        summary = EvidenceSummary(evidence_id=evidence_id, content=content, model=llm.MODEL)
    else:
        summary.content = content
        summary.model = llm.MODEL
        summary.generated_at = utcnow()
    session.add(summary)
    session.commit()
    session.refresh(summary)
    return summary
