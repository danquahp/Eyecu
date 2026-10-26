import hashlib
import mimetypes
import shutil
from pathlib import Path
from typing import Any
from uuid import uuid4
import magic
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session
from ..adapters.registry import get_adapter
from ..config import STORAGE_ROOT
from ..db import get_session
from ..models import Evidence, EvidenceType, ToolName
from ..services import doctext, identify, reputation
from ..services.browse import CategorizedEntry, TreeEntry, extract_file, list_all_files, list_directory
from ..services.search import SearchHit, search_evidence




router = APIRouter(prefix="/api/evidence", tags=["browse"])

BROWSABLE_TYPES = {EvidenceType.DISK_IMAGE, EvidenceType.MOBILE_EXTRACTION}

RUNNABLE_TOOLS = {
   "yara": ToolName.YARA,
    "exiftool": ToolName.EXIFTOOL,
    "bulk_extractor": ToolName.BULK_EXTRACTOR,
}





def _get_evidence(evidence_id: str, session: Session) -> Evidence:
    evidence = session.get(Evidence, evidence_id)
    if evidence is None:
        raise HTTPException(404, "Evidence not found")
    return evidence




def _resolve_path(evidence: Evidence, inode: str | None) -> Path:
    if evidence.type in BROWSABLE_TYPES:

        if not inode:
            raise HTTPException(400, "inode is required for evidence of this type")
        cache_dir = STORAGE_ROOT / "extracted" / evidence.id
        try:
            return extract_file(Path(evidence.stored_path), inode, cache_dir)
        except RuntimeError as exc:
            raise HTTPException(422, str(exc)) from exc

        
    return Path(evidence.stored_path)




@router.get("/{evidence_id}/tree", response_model=list[TreeEntry])
def get_tree(evidence_id: str, inode: str | None = None, session: Session = Depends(get_session)) -> list[TreeEntry]:
    evidence = _get_evidence(evidence_id, session)
    if evidence.type not in BROWSABLE_TYPES:
        raise HTTPException(400, f"{evidence.type.value} evidence has no browsable file system")
    try:
        return list_directory(Path(evidence.stored_path), inode)
    except RuntimeError as exc:
        raise HTTPException(422, str(exc)) from exc





@router.get("/{evidence_id}/categories", response_model=dict[str, list[CategorizedEntry]])


def get_categories(evidence_id: str, session: Session = Depends(get_session)) -> dict[str, list[CategorizedEntry]]:
    evidence = _get_evidence(evidence_id, session)
    if evidence.type not in BROWSABLE_TYPES:
        raise HTTPException(400, f"{evidence.type.value} evidence has no browsable file system")
    try:
        entries = list_all_files(Path(evidence.stored_path))
    except RuntimeError as exc:
        raise HTTPException(422, str(exc)) from exc

    buckets: dict[str, list[CategorizedEntry]] = {}


    for entry in entries:
        buckets.setdefault(entry.category, []).append(entry)
    for bucket in buckets.values():
        bucket.sort(key=lambda e: e.path.lower())


    return buckets


@router.get("/{evidence_id}/search", response_model=list[SearchHit])



def search_image(
    evidence_id: str, q: str, session: Session = Depends(get_session)
) -> list[SearchHit]:
    evidence = _get_evidence(evidence_id, session)
    if evidence.type not in BROWSABLE_TYPES:
        raise HTTPException(400, f"{evidence.type.value} evidence has no browsable file system")
    if not q.strip():
        raise HTTPException(400, "Search keyword cannot be empty")

    cache_dir = STORAGE_ROOT / "extracted" / evidence_id
    try:
        return search_evidence(Path(evidence.stored_path), q.strip(), cache_dir)
    except RuntimeError as exc:
        raise HTTPException(422, str(exc)) from exc





class AdHocFindingOut(BaseModel):
    type: str
    description: str
    confidence: int
    severity: str




class AdHocRunOut(BaseModel):
    tool: str
    log: str
    findings: list[AdHocFindingOut]
    metadata: Any = None





@router.get("/{evidence_id}/run/{tool}", response_model=AdHocRunOut)
def run_tool_on_file(
    evidence_id: str, tool: str, inode: str | None = None, session: Session = Depends(get_session)
) -> AdHocRunOut:
    """On-demand single-file run of one of the real tool adapters (YARA,
    ExifTool, Bulk Extractor) against whatever file is currently open in
    the preview — the same adapters the ingest pipeline uses, but run ad
    hoc and returned directly without persisting a Job/Finding row."""
    tool_name = RUNNABLE_TOOLS.get(tool)
    if tool_name is None:
        raise HTTPException(404, f"Unknown tool '{tool}' — choose one of {sorted(RUNNABLE_TOOLS)}")

    evidence = _get_evidence(evidence_id, session)
    path = _resolve_path(evidence, inode)

    adapter = get_adapter(tool_name)
    if not adapter.is_available():
        raise HTTPException(503, f"{tool_name.value} is not installed on this host")

    workdir = STORAGE_ROOT / "adhoc" / evidence_id / f"{tool}-{uuid4().hex[:8]}"
    workdir.mkdir(parents=True, exist_ok=True)
    try:
        try:
            result = adapter.run(path, workdir)
        except RuntimeError as exc:
            raise HTTPException(422, str(exc)) from exc
    finally:
        shutil.rmtree(workdir, ignore_errors=True)





    return AdHocRunOut(
        tool=tool_name.value,
        log=result.log,
        findings=[
            AdHocFindingOut(
                type=f.type.value, description=f.description, confidence=f.confidence, severity=f.severity.value
            )
            for f in result.findings
        ],
        metadata=result.metadata,
    )





@router.get("/{evidence_id}/file")
def get_file(evidence_id: str, inode: str | None = None, session: Session = Depends(get_session)) -> FileResponse:
    evidence = _get_evidence(evidence_id, session)
    path = _resolve_path(evidence, inode)
    display_name = inode if evidence.type in BROWSABLE_TYPES else evidence.name
    return FileResponse(path, media_type=_guess_type(path), filename=display_name)


class DocTextOut(BaseModel):

    text: str




@router.get("/{evidence_id}/doctext", response_model=DocTextOut)
def get_legacy_doc_text(
    evidence_id: str, inode: str | None = None, session: Session = Depends(get_session)
) -> dict:
    """Plain-text fallback for old binary .doc files, which have no safe
    browser-side preview option."""
    evidence = _get_evidence(evidence_id, session)
    path = _resolve_path(evidence, inode)
    try:
        return {"text": doctext.extract_legacy_doc_text(path)}
    except RuntimeError as exc:
        raise HTTPException(422, str(exc)) from exc





class IdentifyOut(BaseModel):
    method: str
    guess: str
    confidence: str
    size_bytes: int
    note: str | None = None





@router.get("/{evidence_id}/identify", response_model=IdentifyOut)
async def identify_file_type(
    evidence_id: str, inode: str | None = None, session: Session = Depends(get_session)
) -> dict:
    evidence = _get_evidence(evidence_id, session)
    path = _resolve_path(evidence, inode)
    return await identify.identify_file(path)





class ReputationOut(BaseModel):
    configured: bool
    known_to_virustotal: bool | None = None
    malicious_votes: int | None = None
    suspicious_votes: int | None = None
    harmless_votes: int | None = None
    undetected_votes: int | None = None
    total_engines: int | None = None
    detection_names: list[str] | None = None
    names_seen: list[str] | None = None
    note: str | None = None
    error: str | None = None
    sha256: str | None = None





@router.get("/{evidence_id}/reputation", response_model=ReputationOut)
async def check_reputation(
    evidence_id: str, inode: str | None = None, session: Session = Depends(get_session)
) -> dict:
    #Hash-only lookup against VirusTotal only the SHA-256 fingerprint is ever sent, never the file's actual content."""
    evidence = _get_evidence(evidence_id, session)
    path = _resolve_path(evidence, inode)
    sha256 = hashlib.sha256(path.read_bytes()).hexdigest()
    result = await reputation.check_hash(sha256)
    result["sha256"] = sha256
    return result




def _guess_type(path: Path) -> str:
    try:
        detected = magic.from_file(str(path), mime=True)
        if detected:
            return detected
    except Exception:
        pass
    guessed, _ = mimetypes.guess_type(path.name)
    return guessed or "application/octet-stream"
