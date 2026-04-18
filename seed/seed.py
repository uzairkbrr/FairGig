"""
FairGig demo-data seeder.

Writes directly to each service's SQLite file (no HTTP). Idempotent — wipes
and re-seeds every run so the city-median and anomaly panels have consistent data.

Run from the repo root:   python seed/seed.py
"""
from __future__ import annotations

import os
import random
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEED = 7
random.seed(SEED)

AUTH_DB      = ROOT / "services" / "auth"      / "auth.db"
EARNINGS_DB  = ROOT / "services" / "earnings"  / "earnings.db"
GRIEVANCE_DB = ROOT / "services" / "grievance" / "grievance.db"

# ensure parent dirs exist
for p in (AUTH_DB, EARNINGS_DB, GRIEVANCE_DB):
    p.parent.mkdir(parents=True, exist_ok=True)

# --------------- passwords ---------------
try:
    from passlib.context import CryptContext
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def hash_password(s: str) -> str:
        return pwd.hash(s)
except Exception as e:
    print("passlib not available – did you run `npm run setup`?", e, file=sys.stderr)
    sys.exit(1)


# --------------- schemas ---------------
AUTH_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('worker','verifier','advocate')),
  name       TEXT NOT NULL,
  city       TEXT,
  category   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
"""
EARNINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS shifts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id           INTEGER NOT NULL,
  platform            TEXT NOT NULL,
  shift_date          TEXT NOT NULL,
  hours               REAL NOT NULL,
  gross               INTEGER NOT NULL,
  deductions          INTEGER NOT NULL,
  net                 INTEGER NOT NULL,
  category            TEXT,
  city                TEXT,
  note                TEXT,
  screenshot_path     TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  verified_by         INTEGER,
  verified_at         TEXT,
  verifier_note       TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shifts_worker ON shifts(worker_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(verification_status);
CREATE INDEX IF NOT EXISTS idx_shifts_date   ON shifts(shift_date);
"""
GRIEVANCE_SCHEMA = """
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  cluster_id INTEGER,
  moderated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS complaint_tags (
  complaint_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (complaint_id, tag)
);
CREATE TABLE IF NOT EXISTS clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def reset(path: Path, schema: str) -> sqlite3.Connection:
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    conn.executescript(schema)
    return conn


# --------------- demo users ---------------
CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad"]
CATEGORIES_PLATFORMS = {
    "rider":    ["Careem", "Bykea", "InDrive"],
    "driver":   ["Careem", "Uber", "InDrive"],
    "designer": ["Upwork", "Fiverr"],
    "delivery": ["Foodpanda", "Careem"],
    "domestic": ["LocalApp", "Careem"],
}
FIRST = ["Ahmed", "Ali", "Fatima", "Sana", "Hassan", "Bilal", "Sara", "Usman", "Maryam", "Zainab",
        "Kashif", "Hira", "Nadia", "Imran", "Tariq", "Aisha", "Shahid", "Rabia", "Farhan", "Zara",
        "Saqib", "Noor", "Salman", "Asma", "Arif", "Maham", "Faisal", "Ayesha", "Waqar", "Hina",
        "Yasir", "Anum", "Naveed", "Saima", "Junaid", "Mehwish", "Raza", "Bushra", "Haider", "Iqra",
        "Shoaib", "Mahnoor", "Adnan", "Sobia", "Rehan", "Laiba", "Kamran", "Rubab", "Omer", "Sadia"]
LAST = ["Khan", "Ahmad", "Malik", "Shah", "Hussain", "Iqbal", "Siddiqui", "Raza", "Qureshi", "Butt"]


def seed_users() -> tuple[dict[int, dict], dict[int, dict]]:
    print("· seeding auth.db")
    conn = reset(AUTH_DB, AUTH_SCHEMA)
    passwd = hash_password("password123")

    # Fixed demo accounts
    demo = [
        ("rider.ahmed@fairgig.pk",   "worker",  "Ahmed Khan",      "Lahore",    "rider"),
        ("designer.sana@fairgig.pk", "worker",  "Sana Malik",      "Karachi",   "designer"),
        ("verifier@fairgig.pk",      "verifier","Verifier 1",      None,        None),
        ("advocate@fairgig.pk",      "advocate","Advocate 1",      None,        None),
    ]
    for email, role, name, city, category in demo:
        conn.execute("INSERT INTO users(email,password,role,name,city,category) VALUES (?,?,?,?,?,?)",
                     (email, passwd, role, name, city, category))

    # 50 synthetic workers
    extra_workers: list[tuple] = []
    for i in range(50):
        name = f"{FIRST[i % len(FIRST)]} {LAST[i % len(LAST)]}"
        category = random.choice(list(CATEGORIES_PLATFORMS))
        city = random.choice(CITIES)
        email = f"worker{i:02d}@fairgig.pk"
        extra_workers.append((email, passwd, "worker", name, city, category))
    conn.executemany(
        "INSERT INTO users(email,password,role,name,city,category) VALUES (?,?,?,?,?,?)",
        extra_workers,
    )
    conn.commit()

    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM users").fetchall()
    conn.close()
    workers = {r["id"]: dict(r) for r in rows if r["role"] == "worker"}
    staff = {r["id"]: dict(r) for r in rows if r["role"] in {"verifier", "advocate"}}
    print(f"  {len(workers)} workers · {len(staff)} staff")
    return workers, staff


# --------------- shifts ---------------
def seed_shifts(workers: dict[int, dict], staff: dict[int, dict]):
    print("· seeding earnings.db")
    conn = reset(EARNINGS_DB, EARNINGS_SCHEMA)

    today = datetime.now().date()
    # commission rate baselines per platform (plausible Pakistan numbers)
    base_commission = {
        "Careem": 0.22, "Bykea": 0.18, "InDrive": 0.15, "Uber": 0.25,
        "Foodpanda": 0.22, "Upwork": 0.10, "Fiverr": 0.20, "LocalApp": 0.15,
    }
    # expected net-per-hour
    base_rate = {
        "rider": 450, "driver": 550, "designer": 1200,
        "delivery": 380, "domestic": 320,
    }

    verifier_ids = [uid for uid, u in staff.items() if u["role"] == "verifier"]
    verifier_id = verifier_ids[0] if verifier_ids else None

    rows: list[tuple] = []

    for wid, w in workers.items():
        category = w["category"]
        city = w["city"]
        platforms = CATEGORIES_PLATFORMS[category]
        personal_rate = base_rate[category] * random.uniform(0.75, 1.15)

        # 120 days of history
        for days_ago in range(120, 0, -1):
            # workers skip some days
            if random.random() < 0.35:
                continue
            shift_date = (today - timedelta(days=days_ago)).isoformat()
            platform = random.choices(platforms, k=1)[0]
            hours = round(random.uniform(4, 10), 1)
            commission = base_commission[platform] * random.uniform(0.85, 1.15)

            net = int(hours * personal_rate * random.uniform(0.85, 1.18))
            gross = int(net / (1 - commission))
            deductions = gross - net

            # planted anomalies:
            # 2% chance of a commission spike (heavy deduction) for certain workers
            if wid % 7 == 0 and random.random() < 0.04:
                extra = random.randint(800, 2000)
                deductions += extra
                net = max(0, net - extra)
                gross = net + deductions

            # simulate a recent income crash for a few workers
            if wid % 11 == 0 and days_ago < 25:
                net = int(net * 0.5)
                gross = int(net / max(1 - commission, 0.01))
                deductions = gross - net

            # verification status distribution
            status = random.choices(
                ["pending", "verified", "flagged", "unverifiable"],
                weights=[15, 70, 8, 7],
            )[0]
            has_screenshot = random.random() < 0.75
            screenshot_name = f"seed-{wid}-{days_ago}.png" if has_screenshot else None
            verified_at = None
            if status != "pending":
                verified_at = shift_date + "T10:00:00+00:00"

            rows.append((
                wid, platform, shift_date, hours, gross, deductions, net,
                category, city, None, screenshot_name, status,
                verifier_id if status != "pending" else None,
                verified_at, None,
            ))

    conn.executemany(
        """INSERT INTO shifts
           (worker_id,platform,shift_date,hours,gross,deductions,net,category,city,note,
            screenshot_path,verification_status,verified_by,verified_at,verifier_note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        rows,
    )
    conn.commit()
    n = conn.execute("SELECT COUNT(*) AS n FROM shifts").fetchone()[0]
    # leave a handful of pending items with screenshots for the verifier queue
    conn.execute(
        "UPDATE shifts SET verification_status='pending', screenshot_path=COALESCE(screenshot_path, 'seed-pending.png') "
        "WHERE id IN (SELECT id FROM shifts ORDER BY RANDOM() LIMIT 8)"
    )
    conn.commit()
    conn.close()
    print(f"  {n} shifts")


# --------------- complaints ---------------
COMPLAINT_TEMPLATES = [
    ("commission_hike", "Careem increased the commission from 20% to 27% last Tuesday without any notice. My take-home has dropped noticeably."),
    ("commission_hike", "Foodpanda quietly bumped commission on peak-hour orders. Earnings per delivery are 15% lower this month."),
    ("deactivation",    "My Bykea account was suddenly deactivated with no reason given. I had a 4.9 rating and 2+ years of history."),
    ("deactivation",    "InDrive suspended me after a single passenger dispute. No chance to present my side before the suspension."),
    ("late_payment",    "Upwork held my payment for 10 days claiming a 'review'. No further detail provided."),
    ("late_payment",    "Foodpanda weekly payout delayed by 5 days this week — second time this month."),
    ("unfair_rating",   "I got a 1-star rating from a passenger because of traffic I couldn't control. Support refused to review it."),
    ("wage_theft",      "The app shows a lower gross than what the customer paid — I verified with the customer's receipt."),
    ("safety",          "Area safety issues after 10pm in a specific Lahore zone — we keep getting routed there."),
    ("working_hours",   "App auto-logs-out after 4 hours claiming rest policy, but the timer doesn't reset properly."),
    ("safety",          "Designer on Fiverr harassing me in DMs. Support closed my ticket without action."),
    ("other",           "New 'service fee' appeared on last week's payout report — no explanation in the app."),
]


def seed_complaints(workers: dict[int, dict]):
    print("· seeding grievance.db")
    conn = reset(GRIEVANCE_DB, GRIEVANCE_SCHEMA)

    worker_ids = list(workers)
    total = 0
    for i in range(60):
        wid = random.choice(worker_ids)
        cat, desc = random.choice(COMPLAINT_TEMPLATES)
        platforms = CATEGORIES_PLATFORMS[workers[wid]["category"]]
        plat = random.choice(platforms)
        # age them across the last 30 days
        days_ago = random.randint(0, 30)
        created = (datetime.now() - timedelta(days=days_ago)).isoformat(sep=" ", timespec="seconds")
        status = random.choices(
            ["open", "acknowledged", "escalated", "resolved"],
            weights=[45, 20, 20, 15],
        )[0]
        moderated = 1 if random.random() < 0.55 else 0
        cur = conn.execute(
            "INSERT INTO complaints(worker_id, platform, category, description, status, moderated, created_at) "
            "VALUES (?,?,?,?,?,?,?)",
            (wid, plat, cat, desc, status, moderated, created),
        )
        cid = cur.lastrowid
        # tag it based on category
        tags = {cat.replace("_", "-")}
        if "commission" in cat:
            tags.add("commission-rate")
        if "deactivation" in cat:
            tags.add("account-safety")
        if random.random() < 0.3:
            tags.add("repeat-incident")
        for t in tags:
            conn.execute("INSERT OR IGNORE INTO complaint_tags(complaint_id, tag) VALUES (?,?)", (cid, t))
        total += 1

    # two pre-seeded clusters
    conn.execute("INSERT INTO clusters(label, note) VALUES (?,?)",
                 ("Careem – commission hike Q1", "Mid-quarter commission increase complaints"))
    conn.execute("INSERT INTO clusters(label, note) VALUES (?,?)",
                 ("Bykea – sudden deactivations", "Accounts deactivated without due process"))
    # assign matching complaints to clusters
    conn.execute("UPDATE complaints SET cluster_id=1 WHERE platform='Careem' AND category='commission_hike'")
    conn.execute("UPDATE complaints SET cluster_id=2 WHERE platform='Bykea' AND category='deactivation'")

    conn.commit()
    conn.close()
    print(f"  {total} complaints")


def main():
    workers, staff = seed_users()
    seed_shifts(workers, staff)
    seed_complaints(workers)
    print("\nSeed complete. Accounts: password123")
    print("  rider.ahmed@fairgig.pk      (worker, Lahore, rider)")
    print("  designer.sana@fairgig.pk    (worker, Karachi, designer)")
    print("  verifier@fairgig.pk         (verifier)")
    print("  advocate@fairgig.pk         (advocate)")


if __name__ == "__main__":
    main()
