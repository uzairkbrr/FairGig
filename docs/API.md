# FairGig — API Contract

All services use JSON over HTTP. Authenticated endpoints use `Authorization: Bearer <JWT>` where the JWT is issued by the auth service and signed with the shared `JWT_SECRET`.

Claim format:

```json
{ "sub": "42", "role": "worker", "email": "...", "name": "...", "city": "Lahore", "category": "rider", "type": "access", "iat": 1700000000, "exp": 1700003600 }
```

---

## Auth service — `http://localhost:4001`

| Method | Path | Auth | Body / query | Response |
|---|---|---|---|---|
| POST | `/auth/register` | — | `{email, password, name, role, city?, category?}` | `{access_token, refresh_token, user}` |
| POST | `/auth/login` | — | `{email, password}` | `{access_token, refresh_token, user}` |
| POST | `/auth/refresh` | — | `{refresh_token}` | `{access_token, user}` |
| GET  | `/auth/me` | bearer | — | `User` |
| GET  | `/auth/users` | — | `?role=` | `User[]` |
| GET  | `/auth/users/:id` | — | — | `User` |
| GET  | `/healthz` | — | — | `{status, service}` |

**User** = `{id, email, name, role, city, category}`.

---

## Earnings service — `http://localhost:4002`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/shifts` | worker | Create shift |
| GET  | `/shifts?worker_id=&platform=&status=&from=&to=` | any | Workers are forced to their own `worker_id` |
| GET  | `/shifts/pending-verification` | verifier | Queue |
| GET  | `/shifts/:id` | any | |
| PATCH | `/shifts/:id` | owner worker | Edit while `pending` or `flagged` |
| DELETE | `/shifts/:id` | owner worker | Only while `pending` |
| POST | `/shifts/import` | worker | multipart `file` (CSV) |
| POST | `/shifts/:id/screenshot` | owner worker | multipart `file` (png/jpg/webp/pdf) |
| GET  | `/screenshots/:filename` | — | Serves the file |
| POST | `/shifts/:id/verify` | verifier | `{action: verified\|flagged\|unverifiable, note?}` |
| GET  | `/workers/:id/summary?weeks=` | owner or verifier/advocate | `{total, weekly[], platforms[]}` |
| GET  | `/platforms`, `/cities`, `/categories` | — | Distinct values |
| GET  | `/analytics/shifts` | `X-Internal-Key` | Flat dump for analytics |
| GET  | `/healthz` | — | |

### CSV format

```csv
platform,shift_date,hours,gross,deductions,net
```

---

## Anomaly service — `http://localhost:4003`

**No auth required.** Judges can call this directly.

| Method | Path | Description |
|---|---|---|
| POST | `/detect` | All detectors (commission spikes + income drops + hourly outliers) |
| POST | `/detect/commission-anomalies` | Commission spikes only |
| POST | `/detect/income-drops` | Weekly income drops only |
| POST | `/detect/hourly-outliers` | Hourly-rate outliers only |
| POST | `/detect/from-earnings/:worker_id` | Convenience — pulls shifts from earnings then runs `/detect` |
| GET  | `/healthz` | |

### `POST /detect` request

```json
{
  "worker_id": 42,
  "shifts": [
    {"platform": "Careem", "shift_date": "2026-03-01", "hours": 8.0, "gross": 4200, "deductions":  900, "net": 3300},
    {"platform": "Careem", "shift_date": "2026-03-02", "hours": 7.5, "gross": 3900, "deductions": 2200, "net": 1700}
  ]
}
```

### `POST /detect` response

```json
{
  "worker_id": 42,
  "input_shifts": 2,
  "summary": "Found 1 commission spike(s) across 2 shifts.",
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
      "message": "Commission rate on this Careem shift (56.4%) is far above your Careem average of 21.4%. The platform deducted Rs. 2,200 vs. an expected ~Rs. 835."
    }
  ],
  "weekly_drops": []
}
```

---

## Grievance service — `http://localhost:4004`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/complaints` | worker | Create complaint |
| GET  | `/complaints?platform=&category=&status=&cluster_id=&q=` | any | Filtered list |
| GET  | `/complaints/:id` | — | |
| PATCH | `/complaints/:id` | owner | Pre-escalation edit |
| DELETE | `/complaints/:id` | owner | While status=`open` |
| POST | `/complaints/:id/tags` | advocate | `{tags:[...]}` |
| DELETE | `/complaints/:id/tags/:tag` | advocate | |
| POST | `/complaints/:id/moderate` | advocate | `{moderated: bool}` — flip bulletin visibility |
| POST | `/complaints/:id/escalate` | advocate | |
| POST | `/complaints/:id/resolve` | advocate | `{note?}` |
| GET  | `/clusters` | — | With member count + samples |
| POST | `/clusters` | advocate | `{label, note?}` |
| POST | `/clusters/:id/members` | advocate | `{complaint_ids:[...]}` |
| POST | `/clusters/auto` | advocate | Auto-cluster unclustered complaints |
| GET  | `/tags` | — | `[{tag, n}]` |
| GET  | `/bulletin?limit=` | — | Moderated-only public feed |
| GET  | `/stats/top-categories?days=` | — | Top N categories over the window |
| GET  | `/analytics/complaints` | `X-Internal-Key` | Flat dump for analytics |
| GET  | `/healthz` | — | |

---

## Analytics service — `http://localhost:4005`

Pulls from earnings + grievance over REST, caches for `CACHE_TTL` seconds.

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/commission-trends?weeks=` | `{weeks[], series:[{platform, points:[{week,avg_commission,n}]}]}` |
| GET | `/analytics/income-distribution?city=&category=` | `{zones:[{zone,n,p25,median,p75,...}\|{zone,suppressed:true,n}]}` |
| GET | `/analytics/top-complaints?days=` | `{days, categories:[{category,count}]}` |
| GET | `/analytics/vulnerable-workers` | `{flagged:[{worker_id,name,city,category,last_30d_net,prev_30d_net,drop_pct}], threshold_pct:0.20}` |
| GET | `/analytics/city-median?city=&category=&weeks=` | `{city,category,n,median_weekly_net,p25,p75}` or `{suppressed:true, reason}` |
| GET | `/analytics/overview` | Combined advocate-panel payload |
| GET | `/healthz` | |

### Privacy

`/analytics/city-median` withholds the result when fewer than `MIN_COHORT=3` distinct workers match the slice. The worker dashboard's comparison call goes through this endpoint.

---

## Certificate renderer — `http://localhost:4006`

| Method | Path | Description |
|---|---|---|
| GET | `/certificate?worker_id=&from=&to=&verified_only=` | Print-friendly HTML page |
| GET | `/certificate.json?...` | Same data as JSON |
| POST | `/verify` | Body: `{stamp}`. Returns `{valid, payload?}` |
| GET | `/healthz` | |

The HTML has a `Print / Save as PDF` button and `@media print` CSS. Every render embeds a tamper-evident stamp (`<payload-b64>.<hmac-sha256>`) that a landlord/bank can verify via `POST /verify`.

---

## Inter-service data flow

```
     ┌──────────┐     ┌──────────┐
     │   auth   │◄────│ frontend │───────────────►┐
     └────▲─────┘     └──────────┘                │
          │                │                      │
          │ user lookup    │                      │
          │                ▼                      │
     ┌────┴───────┐  ┌──────────┐  ┌───────────┐  │
     │  analytics │◄─│ earnings │  │ grievance │◄─┤
     └──▲─────────┘  └────▲─────┘  └──────┬────┘  │
        │                 │               │       │
        │       X-Internal│-Key           │       │
        │                 │               │       │
        │          ┌──────┴──────────┐    │       │
        │          │                 │    │       │
        │          │                 ▼    ▼       │
        │    ┌─────┴──────┐   ┌──────────────┐    │
        │    │  anomaly   │   │ certificate  │◄───┘
        │    └────────────┘   └──────────────┘
        │
        └── k-anonymity enforced at /analytics/city-median
```

---

## Postman quick-start

Set `{{BASE}}` collection variables for each service. Pre-request hook for authenticated calls:

```js
pm.request.headers.add({key:"Authorization", value: "Bearer " + pm.environment.get("token")});
```

Log in first via `POST {{AUTH}}/auth/login`, stash `access_token` in an env variable, and all subsequent calls inherit the bearer header.
