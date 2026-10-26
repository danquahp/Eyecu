from __future__ import annotations
import shutil
import subprocess
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any
from ..models import FindingType, Severity, ToolName




@dataclass
class FindingDraft:
    type: FindingType
    description: str
    confidence: int
    severity: Severity




@dataclass
class TimelineDraft:
    time: datetime
    description: str





@dataclass
class AdapterResult:
    log: str
    findings: list[FindingDraft] = field(default_factory=list)
    timeline_events: list[TimelineDraft] = field(default_factory=list)
    # Raw tool-specific output worth showing an investigator even when it didn't trigger a Finding 
    metadata: Any = None



class ToolAdapter(ABC):
    name: ToolName
    binary: str



    def is_available(self) -> bool:
        return shutil.which(self.binary) is not None



    @abstractmethod
    def version(self) -> str:
        ...

    @abstractmethod
    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
        ...



    @staticmethod
    def _exec(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
