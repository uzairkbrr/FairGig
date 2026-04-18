# Analytics service

Aggregates earnings + grievance data for the advocate panel and powers the worker dashboard's city-wide median comparison. FastAPI.

## Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --port 4005 --reload
```

Docs: <http://localhost:4005/docs>

## Env

| Var | Default | Purpose |
|---|---|---|
| `EARNINGS_URL` | `http://localhost:4002` | Pulls shifts |
| `GRIEVANCE_URL` | `http://localhost:4004` | Pulls complaints |
| `AUTH_URL` | `http://localhost:4001` | User lookup |
| `INTERNAL_KEY` | `dev-fairgig-internal` | Shared internal-API key |
| `JWT_SECRET` | `dev-fairgig-secret` | For advocate-only endpoints |
| `MIN_COHORT` | `3` | k-anonymity floor — medians suppressed below this |
| `CACHE_TTL` | `20` | Seconds to cache cross-service pulls |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/commission-trends?weeks=12` | Per-platform weekly avg commission rate |
| GET | `/analytics/income-distribution?city=&category=` | Net-income distribution by city zone |
| GET | `/analytics/top-complaints?days=7` | Top complaint categories this week |
| GET | `/analytics/vulnerable-workers` | Workers with >20% month-on-month net drop |
| GET | `/analytics/city-median?city=&category=` | **Public**: median weekly earnings for a slice, subject to k-anonymity |
| GET | `/analytics/overview` | Combined advocate-panel payload |
| GET | `/healthz` | Liveness |

## k-anonymity

The `/analytics/city-median` endpoint suppresses its result when fewer than `MIN_COHORT` distinct workers match the slice. This is the only way individual worker data could leak through an aggregate query — the worker dashboard's median comparison hits this endpoint, so we enforce it at the service boundary.
