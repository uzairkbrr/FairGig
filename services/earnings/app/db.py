import sqlite3
from contextlib import contextmanager
from .config import EARNINGS_DB

SCHEMA = """
CREATE TABLE IF NOT EXISTS shifts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id           INTEGER NOT NULL,
  platform            TEXT    NOT NULL,
  shift_date          TEXT    NOT NULL,       -- ISO date
  hours               REAL    NOT NULL,
  gross               INTEGER NOT NULL,
  deductions          INTEGER NOT NULL,
  net                 INTEGER NOT NULL,
  category            TEXT,                    -- rider / driver / designer / domestic ...
  city                TEXT,
  note                TEXT,
  screenshot_path     TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending'
       CHECK (verification_status IN ('pending','verified','flagged','unverifiable')),
  verified_by         INTEGER,
  verified_at         TEXT,
  verifier_note       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(verification_status);
CREATE INDEX IF NOT EXISTS idx_shifts_date   ON shifts(shift_date);
"""


def init_db() -> None:
    with connect() as c:
        c.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(EARNINGS_DB)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
