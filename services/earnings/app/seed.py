"""Idempotent self-seeder — runs on startup if `shifts` is empty.

Depends on the auth service being reachable so we can pull the canonical
list of workers/verifiers. Retries with backoff until auth is up.
"""
from __future__ import annotations

import os
import random
import time
from datetime import datetime, timedelta

import httpx

from .db import connect

CATEGORIES_PLATFORMS = {
    "rider":    ["Careem", "Bykea", "InDrive"],
    "driver":   ["Careem", "Uber", "InDrive"],
    "designer": ["Upwork", "Fiverr"],
    "delivery": ["Foodpanda", "Careem"],
    "domestic": ["LocalApp", "Careem"],
}
BASE_COMMISSION = {
    "Careem": 0.22, "Bykea": 0.18, "InDrive": 0.15, "Uber": 0.25,
    "Foodpanda": 0.22, "Upwork": 0.10, "Fiverr": 0.20, "LocalApp": 0.15,
}
BASE_RATE = {"rider": 450, "driver": 550, "designer": 1200, "delivery": 380, "domestic": 320}


def _should_seed() -> bool:
    if os.getenv("SEED_ON_STARTUP", "1").lower() in {"0", "false", "no"}:
        return False
    with connect() as c:
        n = c.execute("SELECT COUNT(*) FROM shifts").fetchone()[0]
    return n == 0


def _fetch_users(auth_url: str, max_wait_s: int = 120) -> tuple[list[dict], int | None]:
    """Poll auth until it returns at least one worker. Return (workers, verifier_id)."""
    deadline = time.time() + max_wait_s
    delay = 1.0
    while time.time() < deadline:
        try:
            r = httpx.get(f"{auth_url}/auth/users", timeout=5.0)
            if r.status_code == 200:
                users = r.json()
                workers = [u for u in users if u["role"] == "worker"]
                verifiers = [u for u in users if u["role"] == "verifier"]
                if workers:
                    return workers, (verifiers[0]["id"] if verifiers else None)
        except httpx.HTTPError:
            pass
        time.sleep(delay)
        delay = min(delay * 1.6, 8.0)
    return [], None


def seed_if_empty() -> int:
    if not _should_seed():
        return 0
    auth_url = os.getenv("AUTH_URL", "http://localhost:4001")
    workers, verifier_id = _fetch_users(auth_url)
    if not workers:
        print(f"[earnings] auth unavailable at {auth_url}; skipping seed")
        return 0

    random.seed(7)
    today = datetime.now().date()
    rows: list[tuple] = []
    for w in sorted(workers, key=lambda u: u["id"]):
        category = w.get("category")
        city = w.get("city")
        if category not in CATEGORIES_PLATFORMS:
            continue
        platforms = CATEGORIES_PLATFORMS[category]
        personal_rate = BASE_RATE[category] * random.uniform(0.75, 1.15)
        for days_ago in range(120, 0, -1):
            if random.random() < 0.35:
                continue
            shift_date = (today - timedelta(days=days_ago)).isoformat()
            platform = random.choice(platforms)
            hours = round(random.uniform(4, 10), 1)
            commission = BASE_COMMISSION[platform] * random.uniform(0.85, 1.15)
            net = int(hours * personal_rate * random.uniform(0.85, 1.18))
            gross = int(net / max(1 - commission, 0.01))
            deductions = gross - net
            # planted anomalies
            if w["id"] % 7 == 0 and random.random() < 0.04:
                extra = random.randint(800, 2000)
                deductions += extra
                net = max(0, net - extra)
                gross = net + deductions
            if w["id"] % 11 == 0 and days_ago < 25:
                net = int(net * 0.5)
                gross = int(net / max(1 - commission, 0.01))
                deductions = gross - net
            status = random.choices(
                ["pending", "verified", "flagged", "unverifiable"],
                weights=[15, 70, 8, 7],
            )[0]
            has_screenshot = random.random() < 0.75
            screenshot_name = f"seed-{w['id']}-{days_ago}.png" if has_screenshot else None
            verified_at = shift_date + "T10:00:00+00:00" if status != "pending" else None
            rows.append((
                w["id"], platform, shift_date, hours, gross, deductions, net,
                category, city, None, screenshot_name, status,
                verifier_id if status != "pending" else None,
                verified_at, None,
            ))

    with connect() as c:
        c.executemany(
            """INSERT INTO shifts
               (worker_id,platform,shift_date,hours,gross,deductions,net,category,city,note,
                screenshot_path,verification_status,verified_by,verified_at,verifier_note)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            rows,
        )
        c.execute(
            "UPDATE shifts SET verification_status='pending', screenshot_path=COALESCE(screenshot_path, 'seed-pending.png') "
            "WHERE id IN (SELECT id FROM shifts ORDER BY RANDOM() LIMIT 8)"
        )
    return len(rows)
