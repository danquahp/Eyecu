from __future__ import annotations
import subprocess
from pathlib import Path
from . import llm


INCONCLUSIVE = {"data", "empty"}



def _file_command_guess(path: Path) -> str:
    result = subprocess.run(["file", "-b", str(path)], capture_output=True, text=True, timeout=30)
    return result.stdout.strip()



def _hex_dump(path: Path, n_bytes: int = 256) -> str:
    data = path.read_bytes()[:n_bytes]
    return data.hex(" ", 1)


async def identify_file(path: Path) -> dict:
    libmagic_guess = _file_command_guess(path)
    size = path.stat().st_size

    if libmagic_guess and libmagic_guess.lower() not in INCONCLUSIVE:
        return {
            "method": "libmagic",
            "guess": libmagic_guess,
            "confidence": "high",
            "size_bytes": size,
        }

    hex_dump = _hex_dump(path)
    if not await llm.is_available():
        return {
            "method": "libmagic",
            "guess": libmagic_guess or "unrecognised binary data",
            "confidence": "low",
            "size_bytes": size,
            "note": f"libmagic could not identify this file, and the local model ({llm.MODEL}) is not reachable",
        }

    reasoning = await llm.identify_from_hex(hex_dump, size, libmagic_guess)
    return {
        "method": "local_llm_hex_analysis",
        "guess": reasoning,
        "confidence": "uncertain",
        "size_bytes": size,
        "note": "libmagic could not identify this file",
    }
