from __future__ import annotations
import json
from datetime import datetime, timezone
from pathlib import Path
from ..models import FindingType, Severity, ToolName
from .base import AdapterResult, FindingDraft, TimelineDraft, ToolAdapter


class ExifToolAdapter(ToolAdapter):
    name = ToolName.EXIFTOOL
    binary = "exiftool"



    def version(self) -> str:
        result = self._exec([self.binary, "-ver"])
        return result.stdout.strip() or "unknown"





    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
        # No tag filter, pull every tag ExifTool can read so the full record


        cmd = [self.binary, "-j"]

        if evidence_path.is_dir():
            cmd += ["-r", str(evidence_path)]
        else:
            cmd.append(str(evidence_path))

        result = self._exec(cmd)



        if result.returncode not in (0, 1):  # exiftool returns 1 on partial warnings
            raise RuntimeError(f"exiftool failed: {result.stderr.strip()}")

        try:
            records = json.loads(result.stdout) if result.stdout.strip() else []
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"could not parse exiftool output : {exc}") from exc



        findings: list[FindingDraft] = []
        timeline_events: list[TimelineDraft] = []
        now = datetime.now(timezone.utc)




        for record in records:

            src = record.get("SourceFile", "")
            claimed_ext = Path(src).suffix.lstrip(".").lower()
            
            actual_ext = str(record.get("FileTypeExtension", "")).lower()
            actual_type = record.get("FileType", "unknown")

            if claimed_ext and actual_ext and claimed_ext != actual_ext:
                findings.append(
                    FindingDraft(
                        type=FindingType.SIGNATURE_MISMATCH,
                        description=(
                            f"{Path(src).name} has extension '.{claimed_ext}' but ExifTool "
                            f"identifies its content as {actual_type} (.{actual_ext})."
                        ),
                        confidence=95,
                        severity=Severity.HIGH,
                    )
                )
                timeline_events.append(
                    TimelineDraft(
                        time=now,
                        description=f"File signature mismatch flagged for {Path(src).name}",
                    )
                )

        log = f"Scanned {len(records)} file(s). {len(findings)} signature mismatches found."
        return AdapterResult(log=log, findings=findings, timeline_events=timeline_events, metadata=records[:200])
