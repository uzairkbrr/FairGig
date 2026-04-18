import os
from pathlib import Path

JWT_SECRET = os.getenv("JWT_SECRET", "dev-fairgig-secret")
JWT_ALG = os.getenv("JWT_ALG", "HS256")
INTERNAL_KEY = os.getenv("INTERNAL_KEY", "dev-fairgig-internal")

EARNINGS_DB = os.getenv("EARNINGS_DB", "earnings.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

STATUSES = {"pending", "verified", "flagged", "unverifiable"}
