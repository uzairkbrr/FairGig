# Architecture

## Service topology

Six backend services, one frontend, each independently runnable:

| Service | Language | Framework | Port | State | Depends on |
|---|---|---|---|---|---|
| auth | Python | FastAPI | 4001 | `auth.db` (SQLite) | — |
| earnings | Python | FastAPI | 4002 | `earnings.db` + `uploads/` | shared JWT secret |
| anomaly | Python | FastAPI | 4003 | **stateless** | optional: earnings (for `/detect/from-earnings/...`) |
| grievance | Node | Express | 4004 | `grievance.db` (SQLite) | shared JWT secret |
| analytics | Python | FastAPI | 4005 | **stateless (TTL cache)** | earnings, grievance, auth |
| certificate | Node | Express | 4006 | **stateless** | earnings, auth |
| frontend | TS | React + Vite | 5173 | localStorage (tokens) | every service |

## Auth flow

1. Frontend `POST /auth/login` → receives `{access_token, refresh_token, user}`.
2. Frontend stores tokens in `localStorage` (`fg_access`, `fg_refresh`) and attaches `Authorization: Bearer <access_token>` to every subsequent call.
3. Each service **locally verifies the JWT** using `JWT_SECRET` — no introspection call back to the auth service. This keeps services independently runnable.
4. Role-based access control is enforced per-endpoint inside each service using the `role` claim.

## Internal-call authentication

Two kinds of service-to-service calls exist:

- **User-initiated**: frontend forwards the user's bearer token, services validate locally. Example: the certificate service is called by the user's browser and forwards the request to earnings' internal endpoint.
- **Service-initiated**: the analytics and certificate services pull bulk data from earnings / grievance. These internal endpoints (`/analytics/shifts`, `/analytics/complaints`) require `X-Internal-Key: $INTERNAL_KEY` — not a user token — so a leaked user token can't dump the whole dataset.

## Database choice

Per-service **SQLite** was chosen deliberately:

- **Independence**: each service is bootstrappable with one command, no external database to spin up.
- **Isolation**: one service's schema migrations can never break another's.
- **Correctness**: SQLite's ACID guarantees and single-file model make the demo reproducible.

Trade-off: analytics aggregates across DBs over REST instead of a join. We accept that because the dataset fits in memory easily and the brief mandates clear REST boundaries between services.

## Privacy model

The only vector for leaking individual worker data through an aggregate is the city-median comparison on the worker dashboard. We mitigate it at the service boundary in `analytics/city-median`:

```
if len(distinct_workers_matching_slice) < MIN_COHORT:   # default 3
    return {"suppressed": True, "n": ..., "reason": "k-anonymity"}
```

The frontend displays a soft "not enough peers yet" message rather than exposing partial data.

## Anomaly detection

Stateless. Three detectors, all pure-python, all returning plain-language explanations:

1. **Commission spike** — z-score of a shift's commission rate against the worker's history on the same platform. Uses leave-one-out baseline so the candidate doesn't bias its own reference.
2. **Weekly income drop** — drop vs. an N-week rolling mean, filtered by a 20% minimum threshold that matches the brief's vulnerability definition.
3. **Hourly outlier** — z-score of a shift's net/hour against the worker's overall average, with a minimum ratio gate to suppress borderline cases.

All three gracefully degrade (return `[]`) when there isn't enough history.

## Frontend

React + Vite + TypeScript + Tailwind + Recharts. Three personas share one app; route guards limit each persona to their legal set of routes.

- `/login`, `/register`
- Worker: `/dashboard`, `/log`, `/shifts`, `/grievance`, `/certificate`
- Verifier: `/verifier`
- Advocate: `/advocate`, `/advocate/grievances`, `/advocate/workers`, `/advocate/workers/:id`

All UI state comes from the REST APIs — there's no duplicated client-side business logic.
