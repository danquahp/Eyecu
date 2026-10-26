from __future__ import annotations
import subprocess
from dataclasses import dataclass
from pathlib import Path
from .browse import list_all_files, extract_file
from .doctext import extract_legacy_doc_text


MAX_CONTENT_SEARCH_FILES = 300
MAX_CONTENT_SEARCH_BYTES = 15 * 1024 * 1024  # 15 MB

PLAIN_TEXT_EXTENSIONS = {"txt", "log", "csv", "json", "xml", "html", "htm", "md", "ini", "conf"}
SEARCHABLE_EXTENSIONS = PLAIN_TEXT_EXTENSIONS | {"pdf", "doc", "docx"}


@dataclass
class SearchHit:
    path: str
    inode: str
    deleted: bool
    matched_in: str 
    snippet: str | None


def _extract_text(path: Path, ext: str) -> str | None:
    try:
        if ext == "pdf":
           result = subprocess.run(["pdftotext", str(path), "-"], capture_output=True, text=True, timeout=20)
           return result.stdout if result.returncode == 0 else None

        
        if ext == "doc":
             return extract_legacy_doc_text(path)
        
        
        if ext == "docx":
               import docx  # python-docx
               document = docx.Document(str(path))
               return "\n".join(p.text for p in document.paragraphs)
        
        if ext in PLAIN_TEXT_EXTENSIONS:
           return path.read_text(errors="ignore")
    except Exception:
        return None
    return None




def _snippet(text: str, keyword: str, context: int = 60) -> str:
    idx = text.lower().find(keyword.lower())
    if idx == -1:
        return ""
    start = max(0, idx - context)
    end = min(len(text), idx + len(keyword) + context)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{' '.join(text[start:end].split())}{suffix}"





def search_evidence(image_path: Path, keyword: str, cache_dir: Path) -> list[SearchHit]:
    keyword_lower = keyword.lower()
    entries = list_all_files(image_path)
    hits: list[SearchHit] = []
    content_searched = 0



    for entry in entries:
        name = Path(entry.path).name
        if keyword_lower in name.lower():
            hits.append(
                SearchHit(path=entry.path, inode=entry.inode, deleted=entry.deleted, matched_in="filename", snippet=None)
            )
            continue

        if content_searched >= MAX_CONTENT_SEARCH_FILES:
            continue

        if entry.size is not None and entry.size > MAX_CONTENT_SEARCH_BYTES:
            continue
        
        ext = Path(entry.path).suffix.lstrip(".").lower()
        
        
        if ext not in SEARCHABLE_EXTENSIONS:
            continue

        content_searched += 1
        try:
            extracted_path = extract_file(image_path, entry.inode, cache_dir)
        except RuntimeError:
            continue

        text = _extract_text(extracted_path, ext)




        if text and keyword_lower in text.lower():
            hits.append(
                SearchHit(
                    path=entry.path,
                    inode=entry.inode,
                    deleted=entry.deleted,
                    matched_in="content",
                    snippet=_snippet(text, keyword),
                )
            )

    return hits
