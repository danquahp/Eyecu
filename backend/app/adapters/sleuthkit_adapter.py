from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from ..models import FindingType, Severity, ToolName
from ..services.browse import TimelineEntry, extract_timeline
from .base import AdapterResult, FindingDraft, TimelineDraft, ToolAdapter
from .sleuthkit_common import ensure_raw_readable, find_main_partition_offset


MAX_TIMELINE_EVENTS = 300


def _parse_fls_time(raw: str | None) -> datetime | None:

    if not raw:
        return None
    head = raw.split(" (", 1)[0]

    try:
        return datetime.strptime(head, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None

#




def _build_timeline_events(files: list[TimelineEntry]) -> list[TimelineDraft]:
    drafts: list[TimelineDraft] = []


    for entry in files:
        user_tag = f" (user: {entry.user})" if entry.user else ""
        crtime = _parse_fls_time(entry.crtime)
        mtime = _parse_fls_time(entry.mtime)
        ctime = _parse_fls_time(entry.ctime)

        if crtime:
            drafts.append(TimelineDraft(time=crtime, description=f"File created: {entry.path}{user_tag}"))

        if mtime and entry.mtime != entry.crtime:
            drafts.append(TimelineDraft(time=mtime, description=f"File modified: {entry.path}{user_tag}"))




        if ctime and entry.ctime not in (entry.mtime, entry.crtime):
            drafts.append(
                TimelineDraft(
                    time=ctime,
                    description=f"File metadata/permissions changed (content unchanged): {entry.path}{user_tag}",
                )
            )



        if entry.deleted:
            best = ctime or mtime or crtime
            if best:
                drafts.append(
                    TimelineDraft(
                        time=best,
                        description=(
                            "exact deletion time isn't recorded by the file system; "
                            f"event time shown is the last recorded metadata change: {entry.path}{user_tag}"
                        ),
                    )
                )

    drafts.sort(key=lambda d: d.time, reverse=True)
    return drafts[:MAX_TIMELINE_EVENTS]


class SleuthKitAdapter(ToolAdapter):

    name = ToolName.AUTOPSY
    binary = "mmls"

    def is_available(self) -> bool:
        import shutil
        return shutil.which("mmls") is not None and shutil.which("fls") is not None
    def version(self) -> str:
        result = self._exec(["mmls", "-V"])
        raw = (result.stdout or result.stderr).strip()
        return raw.rsplit(" ", 1)[-1] if raw else "unknown"




    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
        raw_path = ensure_raw_readable(evidence_path)
        offset = find_main_partition_offset(raw_path)

        try:
            entries = extract_timeline(evidence_path, limit=20000)
        except RuntimeError as exc:
            raise RuntimeError(f"fls failed: {exc}") from exc

        files = [e for e in entries if not e.is_dir]
        deleted = [e for e in files if e.deleted]

        findings: list[FindingDraft] = []
        
        
        if deleted:
            sample = ", ".join(Path(e.path).name for e in deleted[:5])
            more = f" and {len(deleted) - 5} more" if len(deleted) > 5 else ""
            findings.append(
                FindingDraft(
                    type=FindingType.ANOMALY,
                    description=(
                        f"{len(deleted)} deleted file entr{'y' if len(deleted) == 1 else 'ies'} "
                        f"recovered from the file system: {sample}{more}."
                    ),
                    confidence=55,
                    severity=Severity.MEDIUM if len(deleted) > 10 else Severity.LOW,
                )
            )

        timeline_events = _build_timeline_events(files)

        partition_note = f"partition offset {offset} sectors" if offset is not None else "unpartitioned image"
        sampled_note = ",the most recent" if len(timeline_events) >= MAX_TIMELINE_EVENTS else ""
        log = (
            f"Sleuth Kit file listing completed ({partition_note}). {len(files)} file entries, "
            f"{len(deleted)} deleted, {len(timeline_events)} timeline events recorded{sampled_note}."
        )
        metadata = {
            "partition_offset_sectors": offset,
            "deleted_entries": [e.path for e in deleted][:500],
        }
        return AdapterResult(log=log, findings=findings, timeline_events=timeline_events, metadata=metadata)
