from datetime import datetime

from pydantic import BaseModel

from .models import CaseStatus, EvidenceStatus, EvidenceType, GroundTruthLabel, Priority, ToolName


class CaseCreate(BaseModel):
    id: str
    name: str
    investigator: str
    timezone: str = "UTC"
    priority: Priority = Priority.MEDIUM
    status: CaseStatus = CaseStatus.ACTIVE


class CaseUpdate(BaseModel):
    name: str | None = None
    investigator: str | None = None
    timezone: str | None = None
    priority: Priority | None = None
    status: CaseStatus | None = None


class ToolStatusOut(BaseModel):
    name: ToolName
    connected: bool
    version: str
    jobs_active: int
    detail: str | None = None


class EvidenceOut(BaseModel):
    id: str
    name: str
    case_id: str
    type: EvidenceType
    size_bytes: int
    status: EvidenceStatus
    sha256: str | None
    stored_path: str
    ingested: datetime
    tools: list[ToolName]
    ground_truth_label: GroundTruthLabel | None


class LabelUpdate(BaseModel):
    ground_truth_label: GroundTruthLabel | None
