# Auth service

JWT auth with roles (`worker`, `verifier`, `advocate`). FastAPI + SQLite.

## Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --port 4001 --reload
```

Interactive docs: <http://localhost:4001/docs>

## Env

| Var | Default | Purpose |
|---|---|---|
| `JWT_SECRET` | `dev-fairgig-secret` | HMAC secret — MUST match other services |
| `JWT_ALG` | `HS256` | JWT signing algorithm |
| `ACCESS_TTL_MIN` | `60` | Access token lifetime |
| `REFRESH_TTL_DAYS` | `14` | Refresh token lifetime |
| `AUTH_DB` | `./auth.db` | SQLite file |

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Exchange credentials for access + refresh tokens |
| POST | `/auth/refresh` | Exchange refresh token for a fresh access token |
| GET  | `/auth/me` | Return current user from access token |
| GET  | `/auth/users/{id}` | Public user lookup (id, name, city, category, role) — used by other services |
| GET  | `/healthz` | Liveness probe |

## Token format

```
Bearer <JWT>
```

Claims: `sub` (user id), `role`, `email`, `name`, `city`, `category`, `exp`, `iat`, `type` (`access` | `refresh`).
