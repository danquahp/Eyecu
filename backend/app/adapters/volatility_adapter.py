from __future__ import annotations
import sys
from datetime import datetime, timezone
from pathlib import Path
from ..models import ToolName
from .base import AdapterResult, TimelineDraft, ToolAdapter

_CREATE_TIME_FORMATS = ("%Y-%m-%d %H:%M:%S.%f UTC", "%Y-%m-%d %H:%M:%S UTC")


class VolatilityAdapter(ToolAdapter):
#volatility identifies the exact build of Windows the dump came from and if it cant, it fails 
    name = ToolName.VOLATILITY
    binary = "volatility3"

    def is_available(self) -> bool:
        try:
            import volatility3  
            return True
        except ImportError:
            return False




    def version(self) -> str:
        try:
            from volatility3.framework import constants

            return constants.PACKAGE_VERSION
        except ImportError:
            return "not installed"

    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
    #python -m volatility3 does not work hence needs to be launched with 'vol'
        vol_bin = Path(sys.executable).parent / "vol"
        cmd = [str(vol_bin), "-f", str(evidence_path), "windows.pslist"]
        result = self._exec(cmd, timeout=1800)

        if result.returncode != 0:
            raise RuntimeError(f"volatility failed: {result.stderr.strip()[-2000:]}")

        lines = [line for line in result.stdout.splitlines() if line.strip()]


        header_idx = next((i for i, line in enumerate(lines) if line.strip().startswith("PID")), None)
        
        
        if header_idx is None:
            raise RuntimeError("volatility3 produced no recognisable pslist output")

        columns = lines[header_idx].strip().split("\t")
        rows = [dict(zip(columns, line.strip().split("\t"))) for line in lines[header_idx + 1 :]]


        timeline_events: list[TimelineDraft] = []
        for row in rows:
            create_time_raw = row.get("CreateTime", "")
            create_time = self._parse_time(create_time_raw)
            pid = row.get("PID", "?")
            name = row.get("ImageFileName", "unknown")
            timeline_events.append(
                TimelineDraft(
                    time=create_time or datetime.now(timezone.utc),
                    description=f"Process started: {name} (PID {pid})",
                )
            )

        log = f"windows.pslist {len(rows)} processes"
        
        return AdapterResult(log=log, findings=[], timeline_events=timeline_events, metadata=rows[:500])




    @staticmethod
    def _parse_time(raw: str) -> datetime | None:
        raw = raw.strip()
        for fmt in _CREATE_TIME_FORMATS:
            try:
                return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        return None
