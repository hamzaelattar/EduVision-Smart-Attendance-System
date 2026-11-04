"""Environment configuration; no secrets are kept in source code."""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
DATABASE_PATH = Path(os.getenv("EDUVISION_DATABASE_PATH", str(BACKEND_DIR / "database" / "eduvision.db"))).resolve()
CV_PYTHON = Path(os.getenv("EDUVISION_CV_PYTHON", r"F:\anaconda\envs\OPENCV\python.exe"))
BIOMETRIC_KEY = os.getenv("EDUVISION_BIOMETRIC_KEY", "")
ALLOWED_ORIGINS = tuple(x.strip() for x in os.getenv(
    "EDUVISION_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if x.strip())
AUTH_TOKEN_HOURS = int(os.getenv("EDUVISION_AUTH_TOKEN_HOURS", "8"))
DEFAULT_RETENTION_DAYS = int(os.getenv("EDUVISION_RETENTION_DAYS", "30"))
MAX_FRAME_BYTES = int(os.getenv("EDUVISION_MAX_FRAME_BYTES", "1500000"))
MAX_FRAME_RATE = float(os.getenv("EDUVISION_MAX_FRAME_RATE", "2"))
MATCH_THRESHOLD = float(os.getenv("EDUVISION_MATCH_THRESHOLD", "0.65"))
UNCERTAIN_THRESHOLD = float(os.getenv("EDUVISION_UNCERTAIN_THRESHOLD", "0.45"))

if not (0 < UNCERTAIN_THRESHOLD < MATCH_THRESHOLD <= 1):
    raise RuntimeError("Recognition thresholds must satisfy 0 < uncertain < match <= 1")
if not (1 <= DEFAULT_RETENTION_DAYS <= 365):
    raise RuntimeError("EDUVISION_RETENTION_DAYS must be between 1 and 365")
