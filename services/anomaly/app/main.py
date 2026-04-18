import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .detectors import (
    detect_commission_spikes, detect_income_drops, detect_hourly_outliers, detect_all,
)

EARNINGS_URL = os.getenv("EARNINGS_URL", "http://localhost:4002")
INTERNAL_KEY = os.getenv("INTERNAL_KEY", "dev-fairgig-internal")

app = FastAPI(
    title="FairGig Anomaly Detection",
    version="1.0.0",
    description=(
        "Stateless detector service. Accepts a worker's earnings history and returns "
        "flagged anomalies with plain-language explanations. No auth required — judges "
        "can call POST /detect directly with any payload."
    ),
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ------------ schemas ------------
class Shift(BaseModel):
    platform: str = Field(examples=["Careem"])
    shift_date: str = Field(examples=["2026-03-15"], description="ISO date YYYY-MM-DD")
    hours: float = Field(gt=0, examples=[8.0])
    gross: int = Field(ge=0, examples=[4200])
    deductions: int = Field(ge=0, examples=[900])
    net: int = Field(ge=0, examples=[3300])


class DetectIn(BaseModel):
    worker_id: int | None = None
    shifts: list[Shift]

    model_config = {
        "json_schema_extra": {
            "example": {
                "worker_id": 42,
                "shifts": [
                    {"platform": "Careem",    "shift_date": "2026-03-01", "hours": 8.0, "gross": 4200, "deductions":  900, "net": 3300},
                    {"platform": "Careem",    "shift_date": "2026-03-02", "hours": 7.5, "gross": 3900, "deductions":  820, "net": 3080},
                    {"platform": "Careem",    "shift_date": "2026-03-03", "hours": 9.0, "gross": 4500, "deductions":  940, "net": 3560},
                    {"platform": "Careem",    "shift_date": "2026-03-04", "hours": 8.5, "gross": 4100, "deductions": 2300, "net": 1800},
                    {"platform": "Foodpanda", "shift_date": "2026-03-05", "hours": 5.0, "gross": 1800, "deductions":  380, "net": 1420}
                ]
            }
        }
    }


# ------------ routes ------------
@app.get("/healthz")
def healthz():
    return {"status": "ok", "service": "anomaly"}


@app.post("/detect")
def detect(body: DetectIn) -> dict[str, Any]:
    raw = [s.model_dump() for s in body.shifts]
    result = detect_all(raw)
    return {
        "worker_id": body.worker_id,
        "input_shifts": len(raw),
        **result,
    }


@app.post("/detect/commission-anomalies")
def commission_only(body: DetectIn):
    return {"anomalies": detect_commission_spikes([s.model_dump() for s in body.shifts])}


@app.post("/detect/income-drops")
def drops_only(body: DetectIn):
    return {"weekly_drops": detect_income_drops([s.model_dump() for s in body.shifts])}


@app.post("/detect/hourly-outliers")
def hourly_only(body: DetectIn):
    return {"anomalies": detect_hourly_outliers([s.model_dump() for s in body.shifts])}


@app.post("/detect/from-earnings/{worker_id}")
def detect_from_earnings(worker_id: int):
    """
    Convenience: fetches shifts from the earnings service (using the internal key)
    then runs /detect. Useful for a one-click detection path in the UI.
    """
    try:
        r = httpx.get(
            f"{EARNINGS_URL}/analytics/shifts",
            headers={"X-Internal-Key": INTERNAL_KEY},
            timeout=10.0,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"earnings service unreachable: {e}") from e
    shifts = [s for s in r.json() if s.get("worker_id") == worker_id]
    result = detect_all(shifts)
    return {"worker_id": worker_id, "input_shifts": len(shifts), **result}
