# Earnings service

Shift log CRUD, CSV bulk import, screenshot uploads, verification workflow. FastAPI + SQLite.

## Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --port 4002 --reload
```

Docs: <http://localhost:4002/docs>

## Env

| Var | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | `dev-fairgig-secret` | Must match auth service |
| `EARNINGS_DB` | `./earnings.db` | SQLite file |
| `UPLOAD_DIR` | `./uploads` | Screenshot storage |

## Endpoints

### Worker

| Method | Path | Description |
|---|---|---|
| POST | `/shifts` | Create a shift log entry |
| GET  | `/shifts?worker_id&platform&status&from&to` | List shifts |
| GET  | `/shifts/{id}` | Get one shift |
| PATCH | `/shifts/{id}` | Update an unverified shift |
| DELETE | `/shifts/{id}` | Delete (only while `pending`) |
| POST | `/shifts/import` | Multipart CSV import (cols: platform,shift_date,hours,gross,deductions,net) |
| POST | `/shifts/{id}/screenshot` | Multipart screenshot upload |
| GET  | `/screenshots/{filename}` | Serve an uploaded screenshot |
| GET  | `/workers/{id}/summary?weeks=12` | Worker dashboard aggregate |

### Verifier

| Method | Path | Description |
|---|---|---|
| GET  | `/shifts/pending-verification` | Queue of pending items with screenshots |
| POST | `/shifts/{id}/verify` | Body: `{action: "verified"\|"flagged"\|"unverifiable", note}` |

### Meta / analytics internal

| Method | Path | Description |
|---|---|---|
| GET  | `/platforms` | Distinct platform names |
| GET  | `/cities` | Distinct cities |
| GET  | `/categories` | Distinct categories |
| GET  | `/analytics/shifts` | Flat shift dump for the analytics service (requires `X-Internal-Key`) |
| GET  | `/healthz` | Liveness |

## CSV import format

```csv
platform,shift_date,hours,gross,deductions,net
Careem,2026-03-01,8.5,4200,900,3300
Foodpanda,2026-03-02,5,1800,380,1420
```

`shift_date` is ISO (YYYY-MM-DD). All money fields are integers (PKR).
