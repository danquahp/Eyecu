from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional

from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ToolName(StrEnum):
    AUTOPSY = "Autopsy"
    VOLATILITY = "Volatility"
    BULK_EXTRACTOR = "Bulk Extractor"
    EXIFTOOL = "ExifTool"
    YARA = "YARA"
    USB_HISTORY = "USB History"


class EvidenceType(StrEnum):
    DISK_IMAGE = "Disk Image"
    MEMORY_DUMP = "Memory Dump"
    FILE_SET = "File Set"
    MOBILE_EXTRACTION = "Mobile Extraction"


class EvidenceStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETE = "complete"
    FLAGGED = "flagged"
    FAILED = "failed"


class CaseStatus(StrEnum):
    ACTIVE = "active"
    REVIEW = "review"
    CLOSED = "closed"


class Priority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class FindingType(StrEnum):
    SIGNATURE_MISMATCH = "Signature Mismatch"
    ANOMALY = "Anomaly"
    CORRELATION = "Correlation"
    SUSPICIOUS_PATTERN = "Suspicious Pattern"


class Severity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class GroundTruthLabel(StrEnum):
    BENIGN = "benign"
    SUSPICIOUS = "suspicious"
    MALICIOUS = "malicious"


class Case(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    investigator: str
    timezone: str = "UTC"
    opened: datetime = Field(default_factory=utcnow)
    status: CaseStatus = CaseStatus.ACTIVE
    priority: Priority = Priority.MEDIUM




class Evidence(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    case_id: str = Field(foreign_key="case.id", index=True)
    type: EvidenceType
    size_bytes: int
    status: EvidenceStatus = EvidenceStatus.QUEUED
    sha256: Optional[str] = None
    stored_path: str
    ingested: datetime = Field(default_factory=utcnow)
    ground_truth_label: Optional[GroundTruthLabel] = None




class Job(SQLModel, table=True):

    id: Optional[int] = Field(default=None, primary_key=True)
    evidence_id: str = Field(foreign_key="evidence.id", index=True)
    tool: ToolName
    status: JobStatus = JobStatus.QUEUED
    created_at: datetime = Field(default_factory=utcnow)
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    log: str = ""
    error: Optional[str] = None
    result_metadata: Optional[str] = None


class Finding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: str = Field(foreign_key="case.id", index=True)
    evidence_id: Optional[str] = Field(default=None, foreign_key="evidence.id")
    type: FindingType
    description: str
    source: str  
    confidence: int
    severity: Severity
    timestamp: datetime = Field(default_factory=utcnow)




class TimelineEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    case_id: str = Field(foreign_key="case.id", index=True)
    time: datetime
    description: str
    tool: ToolName
    ai_correlated: bool = False




class CaseSummary(SQLModel, table=True):
#Cached LLM-generated narrative for a case, so it isn't regenerated on every page load 
    case_id: str = Field(primary_key=True, foreign_key="case.id")
    content: str
    model: str
    generated_at: datetime = Field(default_factory=utcnow)


class EvidenceSummary(SQLModel, table=True):
    evidence_id: str = Field(primary_key=True, foreign_key="evidence.id")
    content: str
    model: str
    generated_at: datetime = Field(default_factory=utcnow)
