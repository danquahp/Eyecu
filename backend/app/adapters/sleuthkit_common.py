from __future__ import annotations
import re
import subprocess
from pathlib import Path

PARTITION_LINE = re.compile(
    r"^\d{3}:\s+(?P<slot>\S+)\s+(?P<start>\d+)\s+(?P<end>\d+)\s+(?P<length>\d+)\s+(?P<desc>.+)$"
)

EWF_SIGNATURE = b"EVF\x09\x0d\x0a\xff\x00"


def is_ewf(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(8) == EWF_SIGNATURE
    except OSError:
        return False

#solves E01 crashing problem
def ensure_raw_readable(evidence_path: Path) -> Path:

    if not is_ewf(evidence_path):
        return evidence_path

    from ..config import STORAGE_ROOT

    cache_dir = STORAGE_ROOT / "converted"

    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / f"{evidence_path.stem}.raw"
    if dest.exists():
        return dest

    target_stem = cache_dir / evidence_path.stem
    result = subprocess.run(
        ["ewfexport", "-t", str(target_stem), "-f", "raw", "-u", str(evidence_path)],
        capture_output=True,
        text=True,
        timeout=3600,
    )


    if result.returncode != 0 or not dest.exists():
          raise RuntimeError(
            f"failed to convert EWF image to raw: {result.stderr.strip() or result.stdout.strip()}"
          )
    return dest


def find_main_partition_offset(evidence_path: Path) -> int | None:
    #Runs mmls and picks the largest allocated partitions start sector
    result = subprocess.run(["mmls", str(evidence_path)], capture_output=True, text=True, timeout=60)
    
    if result.returncode != 0:
        return None

    best_length = -1
    best_start: int | None = None


    for line in result.stdout.splitlines():
        match = PARTITION_LINE.match(line.strip())
        if not match:
            continue
        desc = match.group("desc").lower()
        if "unallocated" in desc or "meta" in desc:
            continue
        length = int(match.group("length"))
        if length > best_length:
            best_length = length
            best_start = int(match.group("start"))


    return best_start
