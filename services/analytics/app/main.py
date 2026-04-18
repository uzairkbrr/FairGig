from collections import defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median, mean

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import MIN_COHORT
from .sources import fetch_shifts, fetch_complaints, fetch_users

app = FastAPI(title="FairGig Analytics", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ------------ helpers ------------
def _iso_week(dstr: str) -> str:
    d = datetime.fromisoformat(dstr)
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def _user_index() -> dict[int, dict]:
    return {u["id"]: u for u in fetch_users()}


# ------------ routes ------------
@app.get("/healthz")
def health():
    return {"status": "ok", "service": "analytics"}


@app.get("/analytics/commission-trends")
def commission_trends(weeks: int = 12):
    shifts = fetch_shifts()
    by_plat_week: dict[tuple[str, str], list[float]] = defaultdict(list)
    for s in shifts:
        if s["gross"] <= 0:
            continue
        week = _iso_week(s["shift_date"])
        by_plat_week[(s["platform"], week)].append(s["deductions"] / s["gross"])

    # sorted weeks
    all_weeks = sorted({w for _, w in by_plat_week})[-weeks:]
    platforms = sorted({p for p, _ in by_plat_week})
    series = []
    for p in platforms:
        points = []
        for w in all_weeks:
            rates = by_plat_week.get((p, w), [])
            if rates:
                points.append({"week": w, "avg_commission": round(mean(rates), 4), "n": len(rates)})
        if points:
            series.append({"platform": p, "points": points})
    return {"weeks": all_weeks, "series": series}


@app.get("/analytics/income-distribution")
def income_distribution(city: str | None = None, category: str | None = None):
    users = _user_index()
    shifts = fetch_shifts()
    # group shifts by worker → sum net per month
    monthly_by_worker: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for s in shifts:
        w_id = s["worker_id"]
        d = datetime.fromisoformat(s["shift_date"])
        month = f"{d.year}-{d.month:02d}"
        monthly_by_worker[w_id][month] += s["net"]

    # group workers by city (bucket)
    buckets: dict[str, list[int]] = defaultdict(list)
    for w_id, months in monthly_by_worker.items():
        u = users.get(w_id, {})
        if city and u.get("city") != city:
            continue
        if category and u.get("category") != category:
            continue
        if not months:
            continue
        avg_month = int(sum(months.values()) / len(months))
        buckets[u.get("city") or "unknown"].append(avg_month)

    zones = []
    for zone, values in sorted(buckets.items()):
        if len(values) < MIN_COHORT:
            zones.append({"zone": zone, "suppressed": True, "n": len(values)})
            continue
        values.sort()
        p = lambda q: values[min(int(q * (len(values) - 1)), len(values) - 1)]
        zones.append({
            "zone": zone,
            "n": len(values),
            "p25": p(0.25),
            "median": p(0.5),
            "p75": p(0.75),
            "min": values[0],
            "max": values[-1],
        })
    return {"zones": zones}


@app.get("/analytics/top-complaints")
def top_complaints(days: int = 7):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    items = fetch_complaints()
    counts: dict[str, int] = defaultdict(int)
    for c in items:
        try:
            created = datetime.fromisoformat(c["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        if created < cutoff:
            continue
        counts[c["category"]] += 1
    ranked = sorted(counts.items(), key=lambda x: -x[1])[:20]
    return {"days": days, "categories": [{"category": k, "count": v} for k, v in ranked]}


@app.get("/analytics/vulnerable-workers")
def vulnerable_workers():
    """Workers whose most recent 30-day net dropped > 20% vs the prior 30 days."""
    shifts = fetch_shifts()
    users = _user_index()
    now = datetime.now(timezone.utc)
    last_start = now - timedelta(days=30)
    prev_start = now - timedelta(days=60)

    by_worker: dict[int, list[dict]] = defaultdict(list)
    for s in shifts:
        by_worker[s["worker_id"]].append(s)

    flagged = []
    for w_id, items in by_worker.items():
        last_net = 0
        prev_net = 0
        for s in items:
            try:
                d = datetime.fromisoformat(s["shift_date"]).replace(tzinfo=timezone.utc)
            except Exception:
                continue
            if d >= last_start:
                last_net += s["net"]
            elif d >= prev_start:
                prev_net += s["net"]
        if prev_net < 5000:  # ignore workers with too little prior history
            continue
        drop = (prev_net - last_net) / prev_net
        if drop < 0.20:
            continue
        u = users.get(w_id, {})
        flagged.append({
            "worker_id": w_id,
            "name": u.get("name"),
            "city": u.get("city"),
            "category": u.get("category"),
            "last_30d_net": last_net,
            "prev_30d_net": prev_net,
            "drop_pct": round(drop, 3),
        })
    flagged.sort(key=lambda x: -x["drop_pct"])
    return {"flagged": flagged, "threshold_pct": 0.20}


@app.get("/analytics/city-median")
def city_median(
    city: str = Query(..., description="City zone"),
    category: str | None = Query(None, description="Optional worker category filter"),
    weeks: int = 8,
):
    """
    Public endpoint used by the worker dashboard to compare against peer earnings.
    Suppresses the result if fewer than MIN_COHORT distinct workers match the slice.
    """
    shifts = fetch_shifts()
    users = _user_index()

    # collect per-worker weekly totals, filtered by city/category
    worker_weekly: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for s in shifts:
        u = users.get(s["worker_id"], {})
        if u.get("city") != city:
            continue
        if category and u.get("category") != category:
            continue
        worker_weekly[s["worker_id"]][_iso_week(s["shift_date"])] += s["net"]

    if len(worker_weekly) < MIN_COHORT:
        return {
            "city": city, "category": category,
            "suppressed": True, "n": len(worker_weekly),
            "reason": f"k-anonymity: need at least {MIN_COHORT} distinct workers, have {len(worker_weekly)}",
        }

    # compute each worker's average-weekly-net across their active weeks
    averages: list[float] = []
    for w_id, weekly in worker_weekly.items():
        if not weekly:
            continue
        last_weeks = sorted(weekly.items())[-weeks:]
        avg = sum(v for _, v in last_weeks) / len(last_weeks)
        averages.append(avg)
    averages.sort()
    n = len(averages)
    pct = lambda q: averages[min(int(q * (n - 1)), n - 1)]
    return {
        "city": city, "category": category,
        "n": n,
        "median_weekly_net": round(median(averages), 2),
        "p25": round(pct(0.25), 2),
        "p75": round(pct(0.75), 2),
    }


@app.get("/analytics/overview")
def overview():
    """One-shot payload that powers the advocate dashboard landing page."""
    commission = commission_trends(weeks=8)
    distribution = income_distribution()
    top = top_complaints(days=7)
    vulnerable = vulnerable_workers()
    shifts = fetch_shifts()
    complaints = fetch_complaints()
    return {
        "kpis": {
            "total_shifts_logged": len(shifts),
            "total_verified_shifts": sum(1 for s in shifts if s["verification_status"] == "verified"),
            "total_complaints": len(complaints),
            "escalated_complaints": sum(1 for c in complaints if c["status"] == "escalated"),
            "vulnerable_workers": len(vulnerable["flagged"]),
        },
        "commission_trends": commission,
        "income_distribution": distribution,
        "top_complaints": top,
        "vulnerable_workers": vulnerable,
    }
