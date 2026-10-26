from __future__ import annotations
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from ..adapters.sleuthkit_common import ensure_raw_readable, find_main_partition_offset

_ENTRY_HEADER = re.compile(r"^([a-zA-Z\-])/([a-zA-Z\-])\s+(\*\s+)?([\d\-]+):$")


CATEGORY_EXTENSIONS: dict[str, set[str]] = {
    "Images": {"jpg", "jpeg", "png", "gif", "bmp", "tiff", "tif", "ico", "webp", "heic", "svg"},
    "Documents": {"pdf", "doc", "docx", "rtf", "odt", "txt", "md"},
    "Spreadsheets": {"xls", "xlsx", "csv", "ods"},
    "Presentations": {"ppt", "pptx", "odp"},
    "Archives": {"zip", "rar", "7z", "tar", "gz", "bz2"},
    "Executables": {"exe", "dll", "bat", "scr", "com", "msi", "sh", "bin"},
    "Audio/Video": {"mp3", "mp4", "wav", "avi", "mov", "mkv", "flv", "wmv", "m4a"},
}

EXT_TO_CATEGORY: dict[str, str] = {ext: cat for cat, exts in CATEGORY_EXTENSIONS.items() for ext in exts}




def categorize(path: str) -> str:
    ext = Path(path).suffix.lstrip(".").lower()
    return EXT_TO_CATEGORY.get(ext, "Unknown")




@dataclass
class TreeEntry:
    name: str
    inode: str
    is_dir: bool
    deleted: bool
    size: int | None
    modified: str | None




@dataclass
class CategorizedEntry:
    path: str
    inode: str
    deleted: bool
    size: int | None
    category: str




@dataclass
class TimelineEntry:
    path: str
    inode: str
    deleted: bool
    is_dir: bool
    mtime: str | None  # content modified
    atime: str | None  # accessed
    ctime: str | None  # permission changed
    crtime: str | None  # created
    user: str | None  

    @property
    def event_time(self) -> str | None:
        return self.crtime or self.mtime or self.ctime or self.atime


_USER_PATH_RE = re.compile(r"(?:^|/)(?:Users|home)/([^/]+)/", re.IGNORECASE)




def _guess_user(path: str) -> str | None:
    match = _USER_PATH_RE.search(path)
    if not match:
        return None
    name = match.group(1)
    if name.lower() in ("public", "default", "all users", "default user"):
        return None
    return name





def list_directory(image_path: Path, inode: str | None) -> list[TreeEntry]:
    image_path = ensure_raw_readable(image_path)
    offset = find_main_partition_offset(image_path)
    cmd = ["fls", "-l"]
    if offset is not None:
        cmd += ["-o", str(offset)]
    cmd.append(str(image_path))

    if inode:
        cmd.append(inode)

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "fls failed to list this directory")


    entries: list[TreeEntry] = []


    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        header = _ENTRY_HEADER.match(parts[0].strip())
        if not header:
            continue
        _alloc_char, name_type_char, deleted_marker, inode_num = header.groups()
        name = parts[1].strip()
        if name in (".", "..") or name_type_char.lower() == "v":
            continue  # Sleuth Kit's own bookkeeping (e.g. $MBR), not real content


        size = None
        modified = None
        if len(parts) >= 7:
            modified = parts[2].strip() or None
            try:
                size = int(parts[6].strip())
            except ValueError:
                size = None



        entries.append(
            TreeEntry(
                name=name,
                inode=inode_num,
                is_dir=name_type_char.lower() == "d",
                deleted=bool(deleted_marker),
                size=size,
                modified=modified,
            )
        )

    entries.sort(key=lambda e: (not e.is_dir, e.name.lower()))
    return entries


def list_all_files(image_path: Path) -> list[CategorizedEntry]:
    image_path = ensure_raw_readable(image_path)
    offset = find_main_partition_offset(image_path)
    cmd = ["fls", "-r", "-p", "-l"]
    if offset is not None:
        cmd += ["-o", str(offset)]
    cmd.append(str(image_path))

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)




    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "fls failed to list this image")

    entries: list[CategorizedEntry] = []




    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        header = _ENTRY_HEADER.match(parts[0].strip())
        if not header:
            continue
        _alloc_char, name_type_char, deleted_marker, inode_num = header.groups()
        if name_type_char.lower() in ("d", "v"):
            continue  # directories aren't categorised by file type
        path = parts[1].strip()
        if path in (".", ".."):
            continue


        size = None
        if len(parts) >= 7:
            try:
                size = int(parts[6].strip())
            except ValueError:
                size = None

        entries.append(
            CategorizedEntry(
                path=path,
                inode=inode_num,
                deleted=bool(deleted_marker),
                size=size,
                category=categorize(path),
            )
        )

    return entries


def _clean_time(raw: str) -> str | None:
    #if fls prints "0000-00-00 00:00:00 (UTC)" for a timestamp the file system never recorded, treat that as absent
    value = raw.strip() or None
    if value and value.startswith("0000-00-00"):
        return None
    return value


def extract_timeline(image_path: Path, limit: int = 2000) -> list[TimelineEntry]:
    image_path = ensure_raw_readable(image_path)
    offset = find_main_partition_offset(image_path)
    cmd = ["fls", "-r", "-p", "-l"]
    if offset is not None:
        cmd += ["-o", str(offset)]
    cmd.append(str(image_path))


    result = subprocess.run(cmd, capture_output=True, text=True, timeout=900)


    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "fls failed to list this image")

    entries: list[TimelineEntry] = []


    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        if len(parts) < 2:
            continue
        header = _ENTRY_HEADER.match(parts[0].strip())
        if not header:
            continue
        _alloc_char, name_type_char, deleted_marker, inode_num = header.groups()
        if name_type_char.lower() == "v":
            continue  # Sleuth Kit's own bookkeeping, not real content
        path = parts[1].strip()
        if path in (".", ".."):
            continue

        mtime = atime = ctime = crtime = None
        if len(parts) >= 7:
            mtime = _clean_time(parts[2])
            atime = _clean_time(parts[3])
            ctime = _clean_time(parts[4])
            crtime = _clean_time(parts[5])

        entries.append(
            TimelineEntry(
                path=path,
                inode=inode_num,
                deleted=bool(deleted_marker),
                is_dir=name_type_char.lower() == "d",
                mtime=mtime,
                atime=atime,
                ctime=ctime,
                crtime=crtime,
                user=_guess_user(path),
            )
        )
    entries.sort(key=lambda e: e.event_time or "", reverse=True)
    return entries[:limit]





def extract_file(image_path: Path, inode: str, cache_dir: Path) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / inode.replace("/", "_")
    if dest.exists():
        return dest

    image_path = ensure_raw_readable(image_path)
    offset = find_main_partition_offset(image_path)
    cmd = ["icat", "-r"]
    if offset is not None:
        cmd += ["-o", str(offset)]
    cmd += [str(image_path), inode]

    result = subprocess.run(cmd, capture_output=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or b"").decode(errors="replace").strip() or "icat failed to extract this file")

    dest.write_bytes(result.stdout)
    return dest
