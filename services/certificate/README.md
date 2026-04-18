# Certificate renderer

Generates a **print-friendly** HTML income certificate for a worker, covering a date range. Pulls verified shifts from the earnings service and worker info from auth.

## Run

```bash
npm install
npm start          # :4006
```

## Env

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4006` | HTTP port |
| `EARNINGS_URL` | `http://localhost:4002` | Pulls shifts |
| `AUTH_URL` | `http://localhost:4001` | Pulls worker metadata |
| `INTERNAL_KEY` | `dev-fairgig-internal` | Internal key for earnings |
| `CERT_SIGN_SECRET` | `dev-fairgig-cert` | HMAC secret for tamper-evident stamp |

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/certificate?worker_id=N&from=YYYY-MM-DD&to=YYYY-MM-DD&verified_only=true` | Rendered HTML (print with Ctrl+P) |
| GET | `/certificate.json?...` | Same data, JSON (for UI preview) |
| POST | `/verify` | Verify a stamp (body: `{stamp}`) |
| GET | `/healthz` | Liveness |

## Print workflow

The HTML uses `@media print` CSS — open the URL in a browser and hit Ctrl/Cmd-P. A1 letterhead layout on A4.

## Tamper-evident stamp

Every certificate embeds a stamp string of the form `<payload-base64>.<hmac-sha256>`. `POST /verify` recomputes the HMAC and returns the decoded payload if valid. Landlords / banks can paste the stamp into the verify endpoint to confirm the document was rendered by the FairGig service and that the date range + totals match.
