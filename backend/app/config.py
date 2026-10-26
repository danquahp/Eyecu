from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(BACKEND_ROOT / ".env")
STORAGE_ROOT = BACKEND_ROOT / "storage"
EVIDENCE_DIR = STORAGE_ROOT / "evidence"
DB_PATH = STORAGE_ROOT / "db" / "eyecu.db"

EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"


UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024  #8mb

CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
