const Database = require("better-sqlite3");
const path = require("node:path");

const DB_PATH = process.env.GRIEVANCE_DB || path.resolve(process.cwd(), "grievance.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS complaints (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_id    INTEGER NOT NULL,
    platform     TEXT NOT NULL,
    category     TEXT NOT NULL,
    description  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','acknowledged','escalated','resolved','dismissed')),
    cluster_id   INTEGER,
    moderated    INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_complaints_status   ON complaints(status);
  CREATE INDEX IF NOT EXISTS idx_complaints_platform ON complaints(platform);
  CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);

  CREATE TABLE IF NOT EXISTS complaint_tags (
    complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    tag          TEXT    NOT NULL,
    PRIMARY KEY (complaint_id, tag)
  );
  CREATE INDEX IF NOT EXISTS idx_complaint_tags_tag ON complaint_tags(tag);

  CREATE TABLE IF NOT EXISTS clusters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    label      TEXT NOT NULL,
    note       TEXT,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
