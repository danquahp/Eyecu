from __future__ import annotations
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from ..models import FindingType, Severity, ToolName
from .base import AdapterResult, FindingDraft, ToolAdapter


FINDING_WORTHY = {"ccn", "ccn_track2"}

HISTOGRAM_LINE = re.compile(r"^n=(\d+)\t(.+)$")
LOCAL_PATH = re.compile(r"<local_base_path>(.*?)</local_base_path>")


def _local_tag(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]




def _parse_report_counts(report_path: Path) -> dict[str, int]:
    
    
    if not report_path.exists():
        return {}
    tree = ET.parse(report_path)
    counts: dict[str, int] = {}


    for element in tree.getroot().iter():
        if _local_tag(element) != "feature_file":
            continue
        name = count = None
        for child in element:
            tag = _local_tag(child)
            if tag == "name":
                name = child.text
            elif tag == "count":
                count = child.text
        if name is not None and count is not None:
            counts[name] = int(count)
    return counts


def _top_histogram(path: Path, limit: int) -> list[dict]:
    
    
    if not path.exists():
        return []
    entries: list[tuple[int, str]] = []

    
    for line in path.read_text(errors="ignore").splitlines():
        match = HISTOGRAM_LINE.match(line.strip())
        if not match:
            continue
        n, value = match.groups()
        value = re.sub(r"\s*\(utf16=\d+\)\s*$", "", value).strip()
        entries.append((int(n), value))
    entries.sort(key=lambda e: e[0], reverse=True)
    return [{"value": v, "count": n} for n, v in entries[:limit]]

 #Windows shortcut (.lnk) targets carved from unallocated space
def _sample_lnk_paths(path: Path, limit: int) -> list[str]:
   
    if not path.exists():
        return []
    seen: set[str] = set()




    for line in path.read_text(errors="ignore").splitlines():
        match = LOCAL_PATH.search(line)
        if not match:
            continue
        seen.add(match.group(1).replace("\\134", "\\"))
        if len(seen) >= limit:
            break
    return sorted(seen)


class BulkExtractorAdapter(ToolAdapter):
    name = ToolName.BULK_EXTRACTOR
    binary = "bulk_extractor"

    def version(self) -> str:
        result = self._exec([self.binary, "-V"])
        return result.stdout.strip() or result.stderr.strip() or "unknown"




    def run(self, evidence_path: Path, workdir: Path) -> AdapterResult:
        out_dir = workdir / "bulk_extractor_out"
        cmd = [self.binary, "-o", str(out_dir), str(evidence_path)]
        result = self._exec(cmd, timeout=1800)



        if result.returncode != 0:
            raise RuntimeError(
                f"bulk_extractor failed: {result.stderr.strip() or result.stdout.strip()}"
            )

        counts = _parse_report_counts(out_dir / "report.xml")

        findings: list[FindingDraft] = []



        for feature in FINDING_WORTHY:
            count = counts.get(feature, 0)
            if count > 0:
                findings.append(
                    FindingDraft(
                        type=FindingType.SUSPICIOUS_PATTERN,
                        description=(
                            f"bulk extractor accts scanner found {count} Luhn validated "
                            f"{feature.replace('_', ' ')} pattern matches in the raw image; "
                            "pattern-matched, not visually verified against the source file."
                        ),
                        confidence=70,
                        severity=Severity.MEDIUM,
                    )
                )



        notable = {
            "feature_counts": counts,
            "top_domains": _top_histogram(out_dir / "domain_histogram.txt", 15),
            "top_emails": _top_histogram(out_dir / "email_histogram.txt", 15),
            "recently_opened_files": _sample_lnk_paths(out_dir / "winlnk.txt", 15),
        }



        summary_bits = [
            f"{counts.get('email', 0)} email addresses",
            f"{counts.get('url', 0)} URLs across {counts.get('domain', 0)} domain hits",
            f"{counts.get('winlnk', 0)} Windows shortcut (.lnk) records",
            f"{counts.get('exif', 0)} embedded EXIF records",
            f"{counts.get('jpeg', 0)} carved JPEGs",
        ]


        if counts.get("aes_keys", 0):
            summary_bits.append(f"{counts['aes_keys']} possible AES key schedule(s)")
        ccn_total = counts.get("ccn", 0) + counts.get("ccn_track2", 0)
        
        if ccn_total:
            summary_bits.append(f"{ccn_total} Luhn-validated credit card number pattern(s)")
        
        else:
            summary_bits.append("no Luhn-validated credit card numbers")

        log = "bulk extractor carved : " + ", ".join(summary_bits) + "."

        return AdapterResult(log=log, findings=findings, metadata=notable)
