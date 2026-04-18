# Anomaly Detection Service

Stateless FastAPI service. Accepts a list of a worker's earnings and returns flagged anomalies with human-readable explanations. **No auth required** — judges are expected to call this directly with crafted payloads.

## Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --port 4003 --reload
```

Interactive docs (Swagger UI with example payloads): <http://localhost:4003/docs>

## Core endpoint

### `POST /detect`

Body:

```json
{
  "worker_id": 42,
  "shifts": [
    { "platform": "Careem", "shift_date": "2026-03-01", "hours": 8.0, "gross": 4200, "deductions": 900, "net": 3300 },
    { "platform": "Careem", "shift_date": "2026-03-02", "hours": 7.5, "gross": 3900, "deductions": 2200, "net": 1700 }
  ]
}
```

Response (abridged):

```json
{
  "worker_id": 42,
  "input_shifts": 2,
  "anomalies": [
    {
      "shift_index": 1,
      "shift_date": "2026-03-02",
      "platform": "Careem",
      "kind": "commission_spike",
      "severity": "high",
      "observed": 0.564,
      "baseline": 0.214,
      "z_score": 4.87,
      "message": "Commission rate on this Careem shift (56%) is far above your Careem average of 21%. The platform deducted Rs. 2,200 vs. an expected ~Rs. 835."
    }
  ],
  "weekly_drops": [],
  "summary": "Found 1 anomaly across 2 shifts."
}
```

## Convenience endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/detect` | All detectors at once (commission spikes + income drops + net-per-hour outliers) |
| POST | `/detect/commission-anomalies` | Per-shift commission-rate outliers only |
| POST | `/detect/income-drops` | Week-over-week income drops only |
| POST | `/detect/hourly-outliers` | Shifts where net/hour is unusually low |
| POST | `/detect/from-earnings/{worker_id}` | Convenience — pulls shifts from the earnings service then runs `/detect` |
| GET  | `/healthz` | Liveness |

## Detection methodology

All detectors return **plain-language explanations** — no bare numbers.

### Commission spike (per-shift)

Baseline = mean commission rate for the worker on the same platform (prior 30 days, excluding the candidate).
A shift is flagged when its commission rate exceeds `baseline + k * stdev`. k=1.5 → medium, k=2.5 → high.

### Income drop (week-over-week)

Baseline = rolling mean of prior N weeks of net income (default N=8).
A week is flagged when its net income is <= `baseline - k * stdev` **and** the percentage drop is >= 20% (matching the brief's vulnerability threshold).

### Hourly-rate outlier (per-shift)

Baseline = worker's overall net-per-hour mean across all shifts.
A shift is flagged when its net/hour is below `baseline - 1.5 * stdev` **and** below 75% of baseline.

## Why this design

- **Stateless** so judges can probe any payload without setting up the rest of the platform.
- **All results carry a severity + human explanation** so the UI can surface them directly.
- **Falls back gracefully** when there isn't enough data: each detector returns `[]` and a note in `summary` rather than erroring.

## Env

| Var | Default | Purpose |
|---|---|---|
| `EARNINGS_URL` | `http://localhost:4002` | Used only by `/detect/from-earnings/{worker_id}` |
| `INTERNAL_KEY` | `dev-fairgig-internal` | Internal key passed to earnings service |
