from __future__ import annotations
import re
from datetime import datetime, timezone
from pathlib import Path
from ..config import BACKEND_ROOT
from ..models import FindingType, Severity, ToolName
from .base import AdapterResult, FindingDraft, TimelineDraft, ToolAdapter

#path to find demo.yar
RULES_FILE = BACKEND_ROOT / "rules" / "demo.yar"

LINE = re.compile(r"^(?P<rule>\S+)\s+\[(?P<meta>.*?)\]\s+(?P<path>.+)$")
SEVERITY_META = re.compile(r'severity\s*=\s*"(?P<sev>low|medium|high)"')

SEVERITY_MAP = {"high": Severity.HIGH, "medium": Severity.MEDIUM, "low": Severity.LOW}
CONFIDENCE_MAP = {"high": 95, "medium": 65, "low": 45}


class YaraAdapter(ToolAdapter):

    name = ToolName.YARA
    binary = "yara"

    def version(self):
        result = self._exec([self.binary, "--version"])
        return result.stdout.strip() or result.stderr.strip() or "unknown"



    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
        if not RULES_FILE.exists():
            raise RuntimeError(f"YARA ruleset not found at {RULES_FILE}")

        cmd = [self.binary, "-w", "-m"]
        if evidence_path.is_dir():
            cmd.append("-r")
        cmd += [str(RULES_FILE), str(evidence_path)]

        result = self._exec(cmd)
        if result.returncode not in (0,):
            raise RuntimeError(f"yara failed: {result.stderr.strip() or result.stdout.strip()}")




        matches = [line for line in result.stdout.splitlines() if line.strip()]
        findings: list[FindingDraft] = []
        timeline_events: list[TimelineDraft] = []
        metadata_matches: list[dict] = []
        now = datetime.now(timezone.utc)

        for line in matches:
            match = LINE.match(line.strip())
            if not match:
                continue
            rule_name = match.group("rule")
            matched_path = match.group("path")


            sev_match = SEVERITY_META.search(match.group("meta"))
            severity_key = sev_match.group("sev") if sev_match else "medium"

            findings.append(
                FindingDraft(
                    type=FindingType.SUSPICIOUS_PATTERN,
                    description=f"'{rule_name}' matches {Path(matched_path).name}.",
                    confidence=CONFIDENCE_MAP[severity_key],
                    severity=SEVERITY_MAP[severity_key],
                )
            )


            timeline_events.append(
            TimelineDraft(
                    time=now,
                    description=f"YARA match ({rule_name}) on {Path(matched_path).name}",
                )
            )

            metadata_matches.append({"rule": rule_name, "file": matched_path, "severity": severity_key})

        log = f"Scanned with {RULES_FILE.name}. {len(matches)} rule match{'es' if len(matches) != 1 else ''}."
        metadata = {
            "ruleset": RULES_FILE.name,
            "target": str(evidence_path),
            "matches": metadata_matches,
        }
        return AdapterResult(log=log, findings=findings, timeline_events=timeline_events, metadata=metadata)
