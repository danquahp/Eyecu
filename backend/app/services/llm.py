from __future__ import annotations

import json
from typing import Iterable

import httpx

from ..models import Case, Evidence, Finding, Job, TimelineEvent
from .browse import TimelineEntry

OLLAMA_URL = "http://127.0.0.1:11434/api/generate"
MODEL = "qwen2.5:7b-instruct"

_SYSTEM_PROMPT = (
    "You are a digital forensics analysis assistant embedded in an investigator's "
    "tool. You are given the structured findings, evidence and timeline a set of "
    "forensic tools Autopsy/Sleuth Kit, Volatility, ExifTool, YARA, Bulk Extractor "
    "produced for one case. Write a concise investigative narrative: what happened, "
    "in what order, which pieces of evidence corroborate each other across tools, and "
    "what looks most worth the investigator's attention. Cite evidence IDs and finding "
    "types when you make a claim. Do not invent facts not present in the data below. "
    "End with one sentence reminding the reader this is AI-generated and must be "
    "verified before use in a report."
)


def _format_context(case: Case, evidence: Iterable[Evidence], findings: Iterable[Finding], timeline: Iterable[TimelineEvent]) -> str:
    lines = [f"Case {case.id}: {case.name} (status={case.status}, priority={case.priority})", ""]

    lines.append("EVIDENCE:")


    for e in evidence:
        lines.append(f"- {e.id} [{e.type}] {e.name} — status={e.status}, {e.size_bytes} bytes")

    lines.append("")
    lines.append("FINDINGS:")


    for f in findings:
        lines.append(
            f"- [{f.severity.upper()}] {f.type} on {f.evidence_id or 'case-level'} "
            f"(source={f.source}, confidence={f.confidence}%): {f.description}"
        )

    lines.append("")
    lines.append("TIMELINE (chronological):")



    for t in sorted(timeline, key=lambda t: t.time):
        lines.append(f"- {t.time.isoformat()} [{t.tool}] {t.description}")

    return "\n".join(lines)


async def generate_case_narrative(
    case: Case,
    evidence: Iterable[Evidence],
    findings: Iterable[Finding],
    timeline: Iterable[TimelineEvent],
) -> str:
    prompt = f"{_SYSTEM_PROMPT}\n\n{_format_context(case, evidence, findings, timeline)}\n\nNarrative:"

    async with httpx.AsyncClient(timeout=180.0) as client:

        response = await client.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": prompt, "stream": False},
        )
        if response.status_code != 200:
            raise RuntimeError(f"Ollama returned {response.status_code}: {response.text[:500]}")
        data = response.json()
        return data.get("response", "").strip()


_EVIDENCE_SYSTEM_PROMPT = (
    "You are a digital forensics analysis assistant. You are given ONE piece of "
    "evidence (for example a disk image, memory dump or file), the forensic tools "
    "that ran against it, their raw output, and any findings they raised. Write a "
    "clear, concise summary of what this specific piece of evidence shows: what "
    "kind of evidence it is, what the tools actually found on or in it (name "
    "recovered or deleted files, suspicious patterns, metadata anomalies, etc. by "
    "name where the data gives you names), and what looks worth the investigator's "
    "attention. Only state what is supported by the data below — if a tool found "
    "nothing notable, say so plainly rather than padding the summary. End with one "
    "sentence reminding the reader this is AI-generated and must be verified before "
    "use in a report."
)

_DISK_TIMELINE_INSTRUCTIONS = (
    "You are ALSO given a FILE ACTIVITY TIMELINE sampled from this disk image "
    "(via the Sleuth Kit's fls): for each file, its creation, last-modified, "
    "last-accessed and MFT-change (MACB) times, whether it was found deleted, and "
    "a best-effort user name guessed from its file path. Your answer MUST have "
    "exactly two parts, in this order:"
    "1. TOOL FINDINGS — summarise what the forensic tools and findings below show."
    "2. FILE ACTIVITY TIMELINE — a short account of notable file creation/edit/"
    "deletion activity in roughly chronological order, and which user's folder "
    "each action is associated with. Treat a changed MFT/ctime with an "
    "unchanged mtime as a likely permission or metadata change rather than a "
    "content edit, and call that out"
    "In part 2, you MUST state plainly that user attribution is inferred only "
    "from the file path, and that the timeline "
    "is a sample of the busiest and most recent activity, not a complete record."
)


_MAX_TIMELINE_ENTRIES_IN_PROMPT = 60


def _format_timeline_context(timeline: Iterable[TimelineEntry]) -> str:
    entries = list(timeline)[:_MAX_TIMELINE_ENTRIES_IN_PROMPT]
    lines = [f"FILE ACTIVITY TIMELINE (sample of {len(entries)} entries, newest first):"]
    
    
    
    
    for e in entries:
        tags = []
        if e.deleted:
            tags.append("DELETED")
        if e.is_dir:
            tags.append("dir")
        if e.user:
            tags.append(f"user={e.user}")
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        lines.append(
            f"- {e.path}{tag_str}: created={e.crtime or '?'}, modified={e.mtime or '?'}, "
            f"accessed={e.atime or '?'}, metadata-changed={e.ctime or '?'}"
        )
    return "\n".join(lines)


def _format_evidence_context(
     evidence: Evidence,
     jobs: Iterable[Job],
     findings: Iterable[Finding],
    timeline: Iterable[TimelineEntry] | None = None,
) -> str:
    lines = [
        f"Evidence {evidence.id}: {evidence.name} [{evidence.type}], "
        f"{evidence.size_bytes} bytes, status={evidence.status}",
        "",
        "TOOL RUNS:",
    ]


    for j in jobs:
        lines.append(f"- {j.tool} ({j.status}): {j.log or 'no log output'}")
        if j.error:
            lines.append(f"  error: {j.error}")
        if j.result_metadata:
            snippet = j.result_metadata[:3000]
            lines.append(f"  raw output: {snippet}")



    lines.append("")
    lines.append("FINDINGS:")


    if not findings:
        lines.append("- none")


    for f in findings:
        lines.append(
            f"- [{f.severity.upper()}] {f.type} (source={f.source}, confidence={f.confidence}%): {f.description}"
        )

    if timeline:
        lines.append("")
        lines.append(_format_timeline_context(timeline))

    return "\n".join(lines)


async def generate_evidence_narrative(
    evidence: Evidence,
    jobs: Iterable[Job],
    findings: Iterable[Finding],
    timeline: Iterable[TimelineEntry] | None = None,
) -> str:
    system_prompt = _EVIDENCE_SYSTEM_PROMPT + (_DISK_TIMELINE_INSTRUCTIONS if timeline else "")
    reminder = (
        "Remember: cover TOOL FINDINGS then FILE ACTIVITY TIMELINE, state that "
        "path-based user attribution is unverified and the timeline is a sample, "
        "and end with one sentence noting this is AI-generated and must be "
        "verified before use in a report.Summary:"
        if timeline
        else "\nSummary:"
    )
    prompt = f"{system_prompt}\n\n{_format_evidence_context(evidence, jobs, findings, timeline)}{reminder}"

   
   
   
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": prompt, "stream": False},
        )
        if response.status_code != 200:
            raise RuntimeError(f"Ollama returned {response.status_code}: {response.text[:500]}")
        data = response.json()
        return data.get("response", "").strip()


_HEX_IDENTIFY_PROMPT = (
    "You are a digital forensics assistant helping identify an unrecognised file "
    "from its raw bytes. A standard signature database (libmagic) could not "
    "identify it. You are given its size and a hex dump of its first bytes. "
    "Look for known magic numbers, header structures, embedded strings, or "
    "patterns you recognise, and give your best guess at what this file is. "
    "If you genuinely cannot tell, say so plainly rather than guessing with "
    "false confidence — a wrong confident guess is worse than an honest "
    "'unclear'. Keep your answer to 2-3 sentences."
)


async def identify_from_hex(hex_dump: str, size_bytes: int, libmagic_guess: str) -> str:
    prompt = (
        f"{_HEX_IDENTIFY_PROMPT}\n\n"
        f"File size: {size_bytes} bytes\n"
        f"libmagic's answer: {libmagic_guess or '(no output)'}\n"
        f"First bytes (hex): {hex_dump}\n\n"
        f"Your assessment:"
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={"model": MODEL, "prompt": prompt, "stream": False},
        )
        if response.status_code != 200:
            raise RuntimeError(f"Ollama returned {response.status_code}: {response.text[:500]}")
        data = response.json()
        return data.get("response", "").strip()




async def is_available() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get("http://127.0.0.1:11434/api/tags")
            if res.status_code != 200:
                return False
            tags = [m["name"] for m in res.json().get("models", [])]
            return any(t.startswith(MODEL.split(":")[0]) for t in tags)
    except Exception:
        return False
