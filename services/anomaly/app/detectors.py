"""
Pure-Python anomaly detectors for gig-worker earnings data.

Each detector returns a list of anomaly dicts shaped like:
    {
      "shift_index": int | None,  # index into input shifts (None for weekly drops)
      "shift_date":  str | None,  # ISO date or ISO week label
      "platform":    str | None,
      "kind":        str,         # "commission_spike" | "income_drop" | "hourly_outlier"
      "severity":    str,         # "low" | "medium" | "high"
      "observed":    float,
      "baseline":    float,
      "z_score":     float | None,
      "message":     str,         # human-readable explanation
    }
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from statistics import mean, pstdev
from typing import Any


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def _fmt_rs(x: float) -> str:
    return f"Rs. {int(round(x)):,}"


def _severity(z: float) -> str:
    if z >= 2.5:
        return "high"
    if z >= 1.5:
        return "medium"
    return "low"


# ---------- commission spikes ----------
def detect_commission_spikes(shifts: list[dict], k_medium: float = 1.5, k_high: float = 2.5) -> list[dict]:
    """
    For each shift, compute commission rate = deductions / gross. Compare against
    mean/stdev of other shifts on the SAME platform for the same worker.
    """
    out: list[dict] = []
    by_plat: dict[str, list[tuple[int, dict, float]]] = defaultdict(list)
    for i, s in enumerate(shifts):
        if s.get("gross", 0) <= 0:
            continue
        rate = s["deductions"] / s["gross"]
        by_plat[s["platform"]].append((i, s, rate))

    for platform, items in by_plat.items():
        if len(items) < 3:
            continue  # not enough history
        rates = [r for _, _, r in items]
        mu = mean(rates)
        sigma = pstdev(rates) if len(rates) > 1 else 0.0
        if sigma == 0:
            continue
        for idx, shift, rate in items:
            # leave-one-out baseline
            others = [r for j, _, r in items if j != idx]
            if not others:
                continue
            b_mu = mean(others)
            b_sigma = pstdev(others) if len(others) > 1 else sigma
            if b_sigma == 0:
                continue
            z = (rate - b_mu) / b_sigma
            if z < k_medium:
                continue
            expected_deductions = shift["gross"] * b_mu
            out.append({
                "shift_index": idx,
                "shift_date": shift.get("shift_date"),
                "platform": platform,
                "kind": "commission_spike",
                "severity": _severity(z if z < k_high else max(z, k_high)),
                "observed": round(rate, 4),
                "baseline": round(b_mu, 4),
                "z_score": round(z, 2),
                "message": (
                    f"Commission rate on this {platform} shift ({_fmt_pct(rate)}) is "
                    f"far above your {platform} average of {_fmt_pct(b_mu)}. "
                    f"The platform deducted {_fmt_rs(shift['deductions'])} vs. an "
                    f"expected ~{_fmt_rs(expected_deductions)}."
                ),
            })
    out.sort(key=lambda a: a["shift_index"] or 0)
    return out


# ---------- weekly income drops ----------
def _iso_week(dstr: str) -> str:
    d = datetime.fromisoformat(dstr)
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def detect_income_drops(shifts: list[dict], window: int = 8, drop_pct_threshold: float = 0.20) -> list[dict]:
    """
    Week-over-week comparison against an N-week rolling mean. A week is flagged
    when net falls >= drop_pct_threshold below the prior rolling baseline AND
    the deviation z-score is >= 1.5.
    """
    weekly: dict[str, int] = defaultdict(int)
    for s in shifts:
        if not s.get("shift_date"):
            continue
        weekly[_iso_week(s["shift_date"])] += s.get("net", 0)
    if len(weekly) < 3:
        return []

    sorted_weeks = sorted(weekly.items())
    out: list[dict] = []
    for i in range(1, len(sorted_weeks)):
        week, net = sorted_weeks[i]
        history = [v for _, v in sorted_weeks[max(0, i - window):i]]
        if len(history) < 2:
            continue
        b_mu = mean(history)
        b_sigma = pstdev(history) if len(history) > 1 else 0
        if b_mu <= 0:
            continue
        drop_pct = (b_mu - net) / b_mu
        if drop_pct < drop_pct_threshold:
            continue
        z = (b_mu - net) / b_sigma if b_sigma > 0 else 3.0
        if z < 1.5 and b_sigma > 0:
            continue
        out.append({
            "shift_index": None,
            "shift_date": week,
            "platform": None,
            "kind": "income_drop",
            "severity": "high" if drop_pct >= 0.5 else ("medium" if drop_pct >= 0.3 else "low"),
            "observed": net,
            "baseline": round(b_mu, 2),
            "z_score": round(z, 2),
            "message": (
                f"Net income for {week} was {_fmt_rs(net)} - "
                f"{_fmt_pct(drop_pct)} below your prior {len(history)}-week rolling "
                f"average of {_fmt_rs(b_mu)}."
            ),
        })
    return out


# ---------- hourly rate outliers ----------
def detect_hourly_outliers(shifts: list[dict], k: float = 1.5, min_ratio: float = 0.75) -> list[dict]:
    """
    A shift is flagged when its net/hour is materially below the worker's overall
    net/hour mean, AND z-score against stdev >= k, AND the ratio drops below min_ratio.
    """
    hourly = [(i, s, s["net"] / s["hours"]) for i, s in enumerate(shifts) if s.get("hours", 0) > 0]
    if len(hourly) < 4:
        return []
    rates = [r for _, _, r in hourly]
    mu = mean(rates)
    sigma = pstdev(rates) if len(rates) > 1 else 0.0
    if sigma == 0 or mu == 0:
        return []
    out: list[dict] = []
    for idx, s, r in hourly:
        if r >= mu * min_ratio:
            continue
        z = (mu - r) / sigma
        if z < k:
            continue
        out.append({
            "shift_index": idx,
            "shift_date": s.get("shift_date"),
            "platform": s.get("platform"),
            "kind": "hourly_outlier",
            "severity": _severity(z),
            "observed": round(r, 2),
            "baseline": round(mu, 2),
            "z_score": round(z, 2),
            "message": (
                f"Effective hourly rate on this shift was {_fmt_rs(r)}/hour - "
                f"{_fmt_pct((mu - r) / mu)} below your usual {_fmt_rs(mu)}/hour. "
                f"That's unusual for a {s.get('platform','this')} shift of {s.get('hours')} hours."
            ),
        })
    return out


def detect_all(shifts: list[dict]) -> dict[str, Any]:
    commission = detect_commission_spikes(shifts)
    drops = detect_income_drops(shifts)
    hourly = detect_hourly_outliers(shifts)
    merged = commission + hourly
    merged.sort(key=lambda a: (a.get("shift_date") or "", a.get("shift_index") or 0))

    parts: list[str] = []
    if commission:
        parts.append(f"{len(commission)} commission spike(s)")
    if drops:
        parts.append(f"{len(drops)} weekly income drop(s)")
    if hourly:
        parts.append(f"{len(hourly)} hourly-rate outlier(s)")
    if not parts:
        summary = f"No anomalies found across {len(shifts)} shifts."
    else:
        summary = "Found " + ", ".join(parts) + f" across {len(shifts)} shifts."

    return {
        "anomalies": merged,
        "weekly_drops": drops,
        "summary": summary,
    }
