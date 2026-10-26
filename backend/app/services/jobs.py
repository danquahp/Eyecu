from __future__ import annotations
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from sqlmodel import Session, select
from ..adapters.base import AdapterResult
from ..adapters.registry import get_adapter
from ..config import STORAGE_ROOT
from ..db import engine
from ..models import Evidence, EvidenceStatus, Finding, Job, JobStatus, Severity, TimelineEvent
from . import ml_classifier

_ML_SOURCE = "ML Classifier"

_QUEUE: asyncio.Queue[int] = asyncio.Queue()
_WORKER_TASK: asyncio.Task | None = None




def enqueue_job(job_id: int) -> None:
    _QUEUE.put_nowait(job_id)




async def start_worker() -> None:
    global _WORKER_TASK
    if _WORKER_TASK is None:
        _WORKER_TASK = asyncio.create_task(worker_loop())




async def worker_loop() -> None:
    while True:
        job_id = await _QUEUE.get()
        try:
            await asyncio.to_thread(_run_job, job_id)
        except Exception:  
            pass
        finally:
            _QUEUE.task_done()


def _run_job(job_id: int) -> None:
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if job is None:
            return

        evidence = session.get(Evidence, job.evidence_id)


        if evidence is None:
            job.status = JobStatus.FAILED
            job.error = "evidence record missing"
            session.add(job)
            session.commit()
            return

        job.status = JobStatus.RUNNING
        job.started_at = datetime.now(timezone.utc)
        session.add(job)
        session.commit()
        _sync_evidence_status(session, evidence)

        try:
            adapter = get_adapter(job.tool)
            if not adapter.is_available():
                raise RuntimeError(f"{job.tool.value} is not installed on this host")

            workdir = STORAGE_ROOT / "jobs" / str(job_id)
            workdir.mkdir(parents=True, exist_ok=True)

            result = adapter.run(Path(evidence.stored_path), workdir)
            _persist_result(session, evidence, job, result)

            if result.metadata is not None:
                job.result_metadata = json.dumps(result.metadata, default=str)

            job.status = JobStatus.COMPLETE
            job.log = result.log
            job.finished_at = datetime.now(timezone.utc)
        except Exception as exc:  # noqa: BLE001 — surfaced honestly to the caller
            job.status = JobStatus.FAILED
            job.error = str(exc)
            job.finished_at = datetime.now(timezone.utc)

        session.add(job)
        session.commit()
        _sync_evidence_status(session, evidence)


def _sync_evidence_status(session: Session, evidence: Evidence) -> None:
    jobs = session.exec(select(Job).where(Job.evidence_id == evidence.id)).all()
    findings = session.exec(select(Finding).where(Finding.evidence_id == evidence.id)).all()

    still_running = any(j.status in (JobStatus.QUEUED, JobStatus.RUNNING) for j in jobs)

    if not still_running and jobs and not any(f.source == _ML_SOURCE for f in findings):
        draft = ml_classifier.score_evidence(evidence, jobs, findings)
       
       
        if draft is not None:
            session.add(
                Finding(
                    case_id=evidence.case_id,
                    evidence_id=evidence.id,
                    type=draft.type,
                    description=draft.description,
                    source=_ML_SOURCE,
                    confidence=draft.confidence,
                    severity=draft.severity,
                )
            )
            session.commit()
            findings = session.exec(select(Finding).where(Finding.evidence_id == evidence.id)).all()

    if still_running:
        status = EvidenceStatus.PROCESSING
    elif any(f.severity == Severity.HIGH for f in findings):
        status = EvidenceStatus.FLAGGED
    elif jobs and all(j.status == JobStatus.FAILED for j in jobs):
        status = EvidenceStatus.FAILED
    else:
        status = EvidenceStatus.COMPLETE

    evidence.status = status
    session.add(evidence)
    session.commit()


def _persist_result(session: Session, evidence: Evidence, job: Job, result: AdapterResult) -> None:
    for draft in result.findings:
        session.add(
            Finding(
                case_id=evidence.case_id,
                evidence_id=evidence.id,
                type=draft.type,
                description=draft.description,
                source=job.tool.value,
                confidence=draft.confidence,
                severity=draft.severity,
            )
        )

        
    for draft in result.timeline_events:
        session.add(
            TimelineEvent(
                case_id=evidence.case_id,
                time=draft.time,
                description=draft.description,
                tool=job.tool,
                ai_correlated=False,
            )
        )
