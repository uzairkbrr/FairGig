import csv
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    FastAPI, HTTPException, Depends, UploadFile, File, Form, Header, Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .config import STATUSES, UPLOAD_DIR, INTERNAL_KEY
from .db import init_db, connect
from .seed import seed_if_empty
from .auth import current_user

app = FastAPI(title="FairGig Earnings", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def _startup():
    init_db()
    # Seed runs in a background thread so /healthz responds immediately —
    # Render's health check shouldn't wait for the full seed.
    import threading
    def _run_seed():
        try:
            n = seed_if_empty()
            if n:
                print(f"[earnings] seeded {n} shifts")
        except Exception as e:  # noqa: BLE001
            print(f"[earnings] seed failed: {e}")
    threading.Thread(target=_run_seed, daemon=True).start()


# ------------ schemas ------------
class ShiftIn(BaseModel):
    platform: str
    shift_date: str
    hours: float = Field(gt=0)
    gross: int = Field(ge=0)
    deductions: int = Field(ge=0)
    net: int = Field(ge=0)
    category: str | None = None
    city: str | None = None
    note: str | None = None


class ShiftUpdate(BaseModel):
    platform: str | None = None
    shift_date: str | None = None
    hours: float | None = Field(default=None, gt=0)
    gross: int | None = Field(default=None, ge=0)
    deductions: int | None = Field(default=None, ge=0)
    net: int | None = Field(default=None, ge=0)
    note: str | None = None


class VerifyIn(BaseModel):
    action: str
    note: str | None = None


# ------------ helpers ------------
def _row(r) -> dict:
    return {k: r[k] for k in r.keys()}


def _worker_or_owner(user: dict, worker_id: int):
    if user["role"] in {"verifier", "advocate"}:
        return
    if int(user["sub"]) != int(worker_id):
        raise HTTPException(403, "cannot access another worker's data")


# ------------ routes ------------
@app.get("/healthz")
def health():
    return {"status": "ok", "service": "earnings"}


@app.post("/shifts", status_code=201)
def create_shift(body: ShiftIn, user: dict = Depends(current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "only workers can log shifts")
    with connect() as c:
        cur = c.execute(
            """INSERT INTO shifts
               (worker_id,platform,shift_date,hours,gross,deductions,net,category,city,note)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                int(user["sub"]), body.platform, body.shift_date, body.hours,
                body.gross, body.deductions, body.net,
                body.category or user.get("category"),
                body.city or user.get("city"),
                body.note,
            ),
        )
        row = c.execute("SELECT * FROM shifts WHERE id=?", (cur.lastrowid,)).fetchone()
    return _row(row)


@app.get("/shifts")
def list_shifts(
    worker_id: int | None = None,
    platform: str | None = None,
    status: str | None = None,
    date_from: str | None = Query(None, alias="from"),
    date_to: str | None = Query(None, alias="to"),
    user: dict = Depends(current_user),
):
    if user["role"] == "worker":
        worker_id = int(user["sub"])  # force scope
    q = "SELECT * FROM shifts WHERE 1=1"
    params: list = []
    if worker_id is not None:
        q += " AND worker_id=?"
        params.append(worker_id)
    if platform:
        q += " AND platform=?"
        params.append(platform)
    if status:
        q += " AND verification_status=?"
        params.append(status)
    if date_from:
        q += " AND shift_date>=?"
        params.append(date_from)
    if date_to:
        q += " AND shift_date<=?"
        params.append(date_to)
    q += " ORDER BY shift_date DESC, id DESC"
    with connect() as c:
        rows = c.execute(q, params).fetchall()
    return [_row(r) for r in rows]


@app.get("/shifts/pending-verification")
def pending(user: dict = Depends(current_user)):
    if user["role"] not in {"verifier", "advocate"}:
        raise HTTPException(403, "verifier only")
    with connect() as c:
        rows = c.execute(
            "SELECT * FROM shifts WHERE verification_status='pending' AND screenshot_path IS NOT NULL "
            "ORDER BY created_at ASC"
        ).fetchall()
    return [_row(r) for r in rows]


@app.get("/shifts/{shift_id}")
def get_shift(shift_id: int, user: dict = Depends(current_user)):
    with connect() as c:
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
    if not r:
        raise HTTPException(404, "shift not found")
    _worker_or_owner(user, r["worker_id"])
    return _row(r)


@app.patch("/shifts/{shift_id}")
def update_shift(shift_id: int, body: ShiftUpdate, user: dict = Depends(current_user)):
    with connect() as c:
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
        if not r:
            raise HTTPException(404, "shift not found")
        if int(user["sub"]) != r["worker_id"] or user["role"] != "worker":
            raise HTTPException(403, "only the owner worker can edit")
        if r["verification_status"] not in {"pending", "flagged"}:
            raise HTTPException(409, "cannot edit a verified/unverifiable shift")
        fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
        if not fields:
            return _row(r)
        sets = ", ".join(f"{k}=?" for k in fields)
        c.execute(f"UPDATE shifts SET {sets} WHERE id=?", (*fields.values(), shift_id))
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
    return _row(r)


@app.delete("/shifts/{shift_id}", status_code=204)
def delete_shift(shift_id: int, user: dict = Depends(current_user)):
    with connect() as c:
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
        if not r:
            raise HTTPException(404, "shift not found")
        if int(user["sub"]) != r["worker_id"]:
            raise HTTPException(403, "only owner can delete")
        if r["verification_status"] != "pending":
            raise HTTPException(409, "only pending shifts can be deleted")
        c.execute("DELETE FROM shifts WHERE id=?", (shift_id,))


@app.post("/shifts/import")
def import_csv(file: UploadFile = File(...), user: dict = Depends(current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "only workers can import")
    raw = file.file.read().decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    required = {"platform", "shift_date", "hours", "gross", "deductions", "net"}
    if not required.issubset(set(reader.fieldnames or [])):
        raise HTTPException(400, f"CSV must have columns: {sorted(required)}")
    created: list[dict] = []
    errors: list[dict] = []
    with connect() as c:
        for i, row in enumerate(reader, start=2):
            try:
                cur = c.execute(
                    """INSERT INTO shifts
                       (worker_id,platform,shift_date,hours,gross,deductions,net,category,city)
                       VALUES (?,?,?,?,?,?,?,?,?)""",
                    (
                        int(user["sub"]), row["platform"].strip(), row["shift_date"].strip(),
                        float(row["hours"]), int(float(row["gross"])),
                        int(float(row["deductions"])), int(float(row["net"])),
                        user.get("category"), user.get("city"),
                    ),
                )
                created.append({"id": cur.lastrowid, "row": i})
            except Exception as exc:  # noqa: BLE001
                errors.append({"row": i, "error": str(exc)})
    return {"created": len(created), "errors": errors, "rows": created}


@app.post("/shifts/{shift_id}/screenshot")
def upload_screenshot(
    shift_id: int,
    file: UploadFile = File(...),
    user: dict = Depends(current_user),
):
    with connect() as c:
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
        if not r:
            raise HTTPException(404, "shift not found")
        if int(user["sub"]) != r["worker_id"]:
            raise HTTPException(403, "only owner can upload screenshot")
        ext = Path(file.filename or "").suffix.lower() or ".bin"
        if ext not in {".png", ".jpg", ".jpeg", ".webp", ".pdf"}:
            raise HTTPException(400, "unsupported file type")
        name = f"{shift_id}-{uuid.uuid4().hex}{ext}"
        dest = UPLOAD_DIR / name
        dest.write_bytes(file.file.read())
        c.execute("UPDATE shifts SET screenshot_path=? WHERE id=?", (name, shift_id))
    return {"screenshot_path": name}


@app.get("/screenshots/{filename}")
def serve_screenshot(filename: str):
    # basic traversal guard
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, "bad filename")
    f = UPLOAD_DIR / filename
    if not f.exists():
        raise HTTPException(404, "not found")
    return FileResponse(f)


@app.post("/shifts/{shift_id}/verify")
def verify(shift_id: int, body: VerifyIn, user: dict = Depends(current_user)):
    if user["role"] != "verifier":
        raise HTTPException(403, "verifier only")
    if body.action not in STATUSES - {"pending"}:
        raise HTTPException(400, f"action must be one of {sorted(STATUSES - {'pending'})}")
    now = datetime.now(timezone.utc).isoformat()
    with connect() as c:
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
        if not r:
            raise HTTPException(404, "shift not found")
        c.execute(
            "UPDATE shifts SET verification_status=?, verified_by=?, verified_at=?, verifier_note=? WHERE id=?",
            (body.action, int(user["sub"]), now, body.note, shift_id),
        )
        r = c.execute("SELECT * FROM shifts WHERE id=?", (shift_id,)).fetchone()
    return _row(r)


@app.get("/workers/{worker_id}/summary")
def worker_summary(worker_id: int, weeks: int = 12, user: dict = Depends(current_user)):
    _worker_or_owner(user, worker_id)
    with connect() as c:
        rows = c.execute(
            "SELECT * FROM shifts WHERE worker_id=? ORDER BY shift_date ASC", (worker_id,)
        ).fetchall()
    from collections import defaultdict
    weekly = defaultdict(lambda: {"gross": 0, "deductions": 0, "net": 0, "hours": 0.0, "shifts": 0})
    by_platform: dict[str, dict] = defaultdict(lambda: {"gross": 0, "deductions": 0, "net": 0, "hours": 0.0, "shifts": 0})
    total = {"gross": 0, "deductions": 0, "net": 0, "hours": 0.0, "shifts": 0, "verified_net": 0}
    for r in rows:
        d = datetime.fromisoformat(r["shift_date"])
        iso_year, iso_week, _ = d.isocalendar()
        wk = f"{iso_year}-W{iso_week:02d}"
        for bucket in (weekly[wk], by_platform[r["platform"]], total):
            bucket["gross"] += r["gross"]
            bucket["deductions"] += r["deductions"]
            bucket["net"] += r["net"]
            bucket["hours"] += r["hours"]
            bucket["shifts"] += 1
        if r["verification_status"] == "verified":
            total["verified_net"] += r["net"]
    # effective hourly rate over all shifts
    ehr = (total["net"] / total["hours"]) if total["hours"] else 0
    weekly_series = [
        {"week": k, **v, "effective_hourly_rate": round(v["net"] / v["hours"], 2) if v["hours"] else 0}
        for k, v in sorted(weekly.items())
    ]
    # keep last N weeks
    weekly_series = weekly_series[-weeks:]
    platform_breakdown = [
        {
            "platform": p,
            **agg,
            "commission_rate": round(agg["deductions"] / agg["gross"], 4) if agg["gross"] else 0,
            "effective_hourly_rate": round(agg["net"] / agg["hours"], 2) if agg["hours"] else 0,
        }
        for p, agg in by_platform.items()
    ]
    return {
        "worker_id": worker_id,
        "total": {**total, "effective_hourly_rate": round(ehr, 2)},
        "weekly": weekly_series,
        "platforms": platform_breakdown,
        "shift_count": len(rows),
    }


# ------------ meta ------------
@app.get("/platforms")
def platforms():
    with connect() as c:
        rows = c.execute(
            "SELECT DISTINCT platform FROM shifts ORDER BY platform"
        ).fetchall()
    return [r["platform"] for r in rows]


@app.get("/cities")
def cities():
    with connect() as c:
        rows = c.execute(
            "SELECT DISTINCT city FROM shifts WHERE city IS NOT NULL ORDER BY city"
        ).fetchall()
    return [r["city"] for r in rows]


@app.get("/categories")
def categories():
    with connect() as c:
        rows = c.execute(
            "SELECT DISTINCT category FROM shifts WHERE category IS NOT NULL ORDER BY category"
        ).fetchall()
    return [r["category"] for r in rows]


# ------------ internal bulk endpoint for analytics service ------------
@app.get("/analytics/shifts")
def analytics_shifts(x_internal_key: str = Header(default="")):
    if x_internal_key != INTERNAL_KEY:
        raise HTTPException(401, "bad internal key")
    with connect() as c:
        rows = c.execute("SELECT * FROM shifts").fetchall()
    return [_row(r) for r in rows]
