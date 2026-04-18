const express = require("express");
const cors = require("cors");
const crypto = require("node:crypto");
const fetch = require("node-fetch");

const { render } = require("./template");

const PORT = Number(process.env.PORT) || 4006;
const EARNINGS_URL = process.env.EARNINGS_URL || "http://localhost:4002";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:4001";
const INTERNAL_KEY = process.env.INTERNAL_KEY || "dev-fairgig-internal";
const SIGN_SECRET = process.env.CERT_SIGN_SECRET || "dev-fairgig-cert";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// --------------- helpers ---------------
function hmac(payload) {
  return crypto.createHmac("sha256", SIGN_SECRET).update(payload).digest("hex");
}

function makeStamp(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

function verifyStamp(stamp) {
  const [payload, sig] = String(stamp).split(".");
  if (!payload || !sig) return null;
  const expected = hmac(payload);
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
}

async function loadCertificateData(workerId, range, verifiedOnly) {
  const [userRes, shiftsRes] = await Promise.all([
    fetch(`${AUTH_URL}/auth/users/${workerId}`),
    fetch(`${EARNINGS_URL}/analytics/shifts`, { headers: { "X-Internal-Key": INTERNAL_KEY } }),
  ]);
  if (!userRes.ok) throw new Error(`auth service: ${userRes.status}`);
  if (!shiftsRes.ok) throw new Error(`earnings service: ${shiftsRes.status}`);

  const worker = await userRes.json();
  const allShifts = await shiftsRes.json();
  const shifts = allShifts
    .filter((s) => s.worker_id === Number(workerId))
    .filter((s) => s.shift_date >= range.from && s.shift_date <= range.to)
    .filter((s) => (verifiedOnly ? s.verification_status === "verified" : true))
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date));

  const totals = { gross: 0, deductions: 0, net: 0, hours: 0, shifts: 0, verified_net: 0 };
  const perPlatformMap = new Map();
  for (const s of shifts) {
    totals.gross += s.gross;
    totals.deductions += s.deductions;
    totals.net += s.net;
    totals.hours += s.hours;
    totals.shifts += 1;
    if (s.verification_status === "verified") totals.verified_net += s.net;

    if (!perPlatformMap.has(s.platform)) {
      perPlatformMap.set(s.platform, { platform: s.platform, shifts: 0, hours: 0, gross: 0, deductions: 0, net: 0 });
    }
    const pp = perPlatformMap.get(s.platform);
    pp.shifts += 1;
    pp.hours += s.hours;
    pp.gross += s.gross;
    pp.deductions += s.deductions;
    pp.net += s.net;
  }
  const perPlatform = [...perPlatformMap.values()].map((p) => ({
    ...p,
    commission_rate: p.gross > 0 ? p.deductions / p.gross : 0,
  }));

  return { worker, shifts, totals, perPlatform };
}

// --------------- routes ---------------
app.get("/healthz", (_req, res) => res.json({ status: "ok", service: "certificate" }));

app.get("/certificate", async (req, res) => {
  try {
    const workerId = Number(req.query.worker_id);
    if (!workerId) return res.status(400).send("worker_id required");
    const range = { from: req.query.from || "2000-01-01", to: req.query.to || "9999-12-31" };
    const verifiedOnly = req.query.verified_only === "true";

    const data = await loadCertificateData(workerId, range, verifiedOnly);
    const generatedAt = new Date().toISOString().slice(0, 19).replace("T", " ") + " UTC";
    const stamp = makeStamp({
      worker_id: workerId,
      worker_name: data.worker.name,
      range,
      totals: data.totals,
      generated_at: generatedAt,
    });
    const html = render({ ...data, range, stamp, generatedAt });
    res.set("content-type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send(`<pre>${e.message}</pre>`);
  }
});

app.get("/certificate.json", async (req, res) => {
  try {
    const workerId = Number(req.query.worker_id);
    const range = { from: req.query.from || "2000-01-01", to: req.query.to || "9999-12-31" };
    const verifiedOnly = req.query.verified_only === "true";
    const data = await loadCertificateData(workerId, range, verifiedOnly);
    const generatedAt = new Date().toISOString();
    const stamp = makeStamp({
      worker_id: workerId,
      worker_name: data.worker.name,
      range,
      totals: data.totals,
      generated_at: generatedAt,
    });
    res.json({ ...data, range, stamp, generated_at: generatedAt });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/verify", (req, res) => {
  const { stamp } = req.body || {};
  if (!stamp) return res.status(400).json({ error: "stamp required" });
  const payload = verifyStamp(stamp);
  if (!payload) return res.status(400).json({ valid: false, error: "bad signature" });
  res.json({ valid: true, payload });
});

app.listen(PORT, () => console.log(`[certificate] listening on :${PORT}`));
