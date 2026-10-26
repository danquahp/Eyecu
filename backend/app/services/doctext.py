from __future__ import annotations

import subprocess
from pathlib import Path


def extract_legacy_doc_text(path: Path) -> str:
    #Plain-text extraction from old binary .doc files (pre-2007 format)

    result = subprocess.run(
        ["catdoc", "-d", "utf-8", "-w", str(path)],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "catdoc failed to extract text from this file")
    return result.stdout
