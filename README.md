# FairGig — Gig Worker Income & Rights Platform

**SOFTEC 2026 Web Dev Competition submission.**
A multi-service platform that lets gig workers in Pakistan log, verify, and understand their earnings across platforms, and gives labour advocates a dashboard to spot systemic unfairness at scale.

## Services at a glance

| Service | Stack | Port | Purpose |
|---|---|---|---|
| `services/auth` | FastAPI + SQLite | 4001 | JWT login, roles (worker / verifier / advocate), refresh |
| `services/earnings` | FastAPI + SQLite | 4002 | Shift log CRUD, CSV import, screenshot upload, verification |
| `services/anomaly` | FastAPI (stateless) | 4003 | Statistical anomaly detection with plain-language explanations |
| `services/grievance` | Node.js + Express + SQLite | 4004 | Complaint CRUD, tagging, clustering, escalation |
| `services/analytics` | FastAPI | 4005 | Aggregate KPIs for advocate panel |
| `services/certificate` | Node.js + Express | 4006 | Print-friendly HTML income certificate |
| `frontend` | React + Vite + TypeScript + Tailwind | 5173 | Worker / Verifier / Advocate UI |

Each service is independently runnable with one command and has its own README. No Docker required.

## Deploy to Render (one-click blueprint)

This repo ships with a [`render.yaml`](render.yaml) Blueprint that deploys the full stack — 6 backend web services plus the frontend as a static site — to Render's free tier in one click.

**Steps:**

1. Push this repo to GitHub (or GitLab / Bitbucket).
2. In the Render dashboard: **New + → Blueprint → pick the repo → Apply**.
3. Render prompts for the four `sync: false` secrets the first time. Use the **same** value for the `JWT_SECRET`-shared field across every service that asks for it (it's declared on auth, earnings, grievance, analytics). Same rule for `INTERNAL_KEY` across earnings, anomaly, grievance, analytics, certificate. `CERT_SIGN_SECRET` is only on the certificate service.
   - `JWT_SECRET` → any long random string (must be identical across services — they verify tokens locally)
   - `INTERNAL_KEY` → any long random string (guards the internal bulk-export endpoints)
   - `CERT_SIGN_SECRET` → any long random string (HMAC key for certificate stamps)
4. First deploy takes ~5 min (pip + npm installs). Each service self-seeds demo data on first boot — visit the static-site URL (named `fairgig` in the blueprint) and log in with the demo accounts.

**Free-tier gotchas:**

- Web services sleep after 15 min of inactivity; the first request after sleep cold-starts in ~30 seconds. The static-site frontend is CDN-served and never sleeps.
- The SQLite files are on ephemeral disks. When a service restarts (deploy, sleep-wake, etc.) the DB is wiped and the self-seeder repopulates the demo data. **Real user signups do not persist** across restarts. That's fine for a demo; attach a paid disk (from $0.25/month) if you want persistence.
- Service-to-service URLs in `render.yaml` assume the names `fairgig-auth`, `fairgig-earnings`, …, `fairgig-anomaly`, `fairgig-analytics`, `fairgig-grievance`, `fairgig-certificate`. If Render appends a random suffix (only happens on a global name collision), edit the corresponding `*_URL` and `VITE_*_URL` env vars in the dashboard.

## One-shot bootstrap (recommended)

From the repo root:

```bash
# 1. Install everything + seed demo data
npm run setup

# 2. Start all services in parallel
npm run dev
```

Then open <http://localhost:5173>.

Demo accounts (password for all: `password123`):

| Role | Email |
|---|---|
| Worker | `rider.ahmed@fairgig.pk` |
| Worker | `designer.sana@fairgig.pk` |
| Verifier | `verifier@fairgig.pk` |
| Advocate | `advocate@fairgig.pk` |

## Manual per-service start

Each service has its own README with detailed instructions. Quick reference:

```bash
# Python services
cd services/auth       && python -m venv .venv && . .venv/Scripts/activate && pip install -r requirements.txt && uvicorn app.main:app --port 4001
cd services/earnings   && ... --port 4002
cd services/anomaly    && ... --port 4003
cd services/analytics  && ... --port 4005

# Node services
cd services/grievance  && npm install && npm start   # port 4004
cd services/certificate && npm install && npm start  # port 4006

# Frontend
cd frontend && npm install && npm run dev            # port 5173
```

## API contract

See [`docs/API.md`](docs/API.md) for the full inter-service and public REST contract, including the anomaly payload schema judges can use to probe the service directly.

## Architecture notes

- **Shared JWT secret.** All services validate tokens locally using the same `JWT_SECRET` env var (default: `dev-fairgig-secret`). No centralised token introspection call.
- **Per-service SQLite.** Services that own data keep it local (auth, earnings, grievance). Analytics and certificate are stateless — they query other services over REST and aggregate.
- **Privacy-first aggregate queries.** The analytics service computes city-wide medians with a minimum k-anonymity floor (`MIN_COHORT = 3`) — if fewer workers match the slice, the median is withheld. This is why aggregate queries don't expose individual workers.
- **Anomaly service is fully stateless.** It accepts a worker's earnings history in the request body and returns flagged anomalies with human-readable explanations. Judges can call it directly with any crafted payload — no auth token, no DB lookup. See `docs/API.md`.
- **City-wide median is computed from seeded records**, not hardcoded. Seed data produces ~50 workers across 4 cities × 3 categories with realistic distributions, so the comparison endpoint returns real numbers.

## Repository layout

```
softec2026/
├── README.md                     (you are here)
├── package.json                  (monorepo scripts: setup, dev)
├── docs/
│   ├── API.md                    (full API contract)
│   └── architecture.md           (service diagram + data flow)
├── services/
│   ├── auth/                     (FastAPI)
│   ├── earnings/                 (FastAPI)
│   ├── anomaly/                  (FastAPI — stateless)
│   ├── grievance/                (Node.js + Express)
│   ├── analytics/                (FastAPI)
│   └── certificate/              (Node.js + Express)
├── frontend/                     (React + Vite + TS + Tailwind)
└── seed/
    └── seed.py                   (cross-service demo-data seeder)
```

## License

MIT. Built for SOFTEC 2026.
