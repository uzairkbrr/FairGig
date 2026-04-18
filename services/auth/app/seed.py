"""Idempotent self-seeder — runs on service startup if the users table is empty."""
import os
import random

from .db import connect
from .security import hash_password

FIRST = [
    "Ahmed", "Ali", "Fatima", "Sana", "Hassan", "Bilal", "Sara", "Usman", "Maryam", "Zainab",
    "Kashif", "Hira", "Nadia", "Imran", "Tariq", "Aisha", "Shahid", "Rabia", "Farhan", "Zara",
    "Saqib", "Noor", "Salman", "Asma", "Arif", "Maham", "Faisal", "Ayesha", "Waqar", "Hina",
    "Yasir", "Anum", "Naveed", "Saima", "Junaid", "Mehwish", "Raza", "Bushra", "Haider", "Iqra",
    "Shoaib", "Mahnoor", "Adnan", "Sobia", "Rehan", "Laiba", "Kamran", "Rubab", "Omer", "Sadia",
]
LAST = ["Khan", "Ahmad", "Malik", "Shah", "Hussain", "Iqbal", "Siddiqui", "Raza", "Qureshi", "Butt"]
CITIES = ["Lahore", "Karachi", "Islamabad", "Faisalabad"]
CATEGORIES = ["rider", "driver", "designer", "delivery", "domestic"]


def _should_seed() -> bool:
    if os.getenv("SEED_ON_STARTUP", "1").lower() in {"0", "false", "no"}:
        return False
    with connect() as c:
        n = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    return n == 0


def seed_if_empty() -> int:
    if not _should_seed():
        return 0
    random.seed(7)
    passwd = hash_password("password123")
    demo = [
        ("rider.ahmed@fairgig.pk",   "worker",   "Ahmed Khan", "Lahore",  "rider"),
        ("designer.sana@fairgig.pk", "worker",   "Sana Malik", "Karachi", "designer"),
        ("verifier@fairgig.pk",      "verifier", "Verifier 1", None,      None),
        ("advocate@fairgig.pk",      "advocate", "Advocate 1", None,      None),
    ]
    rows: list[tuple] = list(demo)
    for i in range(50):
        name = f"{FIRST[i % len(FIRST)]} {LAST[i % len(LAST)]}"
        category = random.choice(CATEGORIES)
        city = random.choice(CITIES)
        rows.append((f"worker{i:02d}@fairgig.pk", "worker", name, city, category))

    with connect() as c:
        for email, role, name, city, cat in rows:
            c.execute(
                "INSERT INTO users(email,password,role,name,city,category) VALUES (?,?,?,?,?,?)",
                (email, passwd, role, name, city, cat),
            )
    return len(rows)
