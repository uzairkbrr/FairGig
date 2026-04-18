# Grievance service

Complaint CRUD, tagging, clustering, escalation workflow. Node.js + Express + SQLite.

## Run

```bash
npm install
npm start
# or
node src/server.js
```

Listens on `http://localhost:4004`.

## Env

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4004` | HTTP port |
| `JWT_SECRET` | `dev-fairgig-secret` | Shared with auth service |
| `GRIEVANCE_DB` | `./grievance.db` | SQLite file |
| `INTERNAL_KEY` | `dev-fairgig-internal` | Internal key for analytics aggregates |

## Endpoints

### Public / worker

| Method | Path | Description |
|---|---|---|
| POST | `/complaints` | Create a complaint (worker role) |
| GET  | `/complaints?platform=&category=&status=&cluster_id=&q=` | List |
| GET  | `/complaints/:id` | Fetch one |
| PATCH | `/complaints/:id` | Owner can edit description before escalation |
| DELETE | `/complaints/:id` | Owner can delete before escalation |

### Advocate-only

| Method | Path | Description |
|---|---|---|
| POST | `/complaints/:id/tags` | Add tags (body: `{tags:["commission","late_payment"]}`) |
| DELETE | `/complaints/:id/tags/:tag` | Remove a tag |
| POST | `/complaints/:id/moderate` | Flip `moderated=true` to publish on bulletin |
| POST | `/complaints/:id/escalate` | Mark escalated |
| POST | `/complaints/:id/resolve` | Mark resolved |
| GET  | `/clusters` | List clusters with member counts |
| POST | `/clusters` | Create a cluster (body: `{label, note}`) |
| POST | `/clusters/:id/members` | Add complaint ids (body: `{complaint_ids:[...]}`) |
| POST | `/clusters/auto` | Auto-cluster pending complaints by shared tag |

### Public

| Method | Path | Description |
|---|---|---|
| GET  | `/tags` | Distinct tags with counts |
| GET  | `/bulletin?limit=50` | Moderated-only public bulletin board |
| GET  | `/stats/top-categories?days=7` | Top complaint categories this week (analytics) |
| GET  | `/healthz` | Liveness |

## Auth

Same `Authorization: Bearer <JWT>` header as the auth service issues. The service verifies the token locally using `JWT_SECRET`.
