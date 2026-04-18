/**
 * Idempotent self-seeder — runs on startup if `complaints` is empty.
 * Fetches worker list from the auth service (retries with backoff).
 */
const db = require("./db");

const AUTH_URL = process.env.AUTH_URL || "http://localhost:4001";
const ENABLED = !["0", "false", "no"].includes(String(process.env.SEED_ON_STARTUP || "1").toLowerCase());

const CATEGORIES_PLATFORMS = {
  rider:    ["Careem", "Bykea", "InDrive"],
  driver:   ["Careem", "Uber", "InDrive"],
  designer: ["Upwork", "Fiverr"],
  delivery: ["Foodpanda", "Careem"],
  domestic: ["LocalApp", "Careem"],
};

const COMPLAINT_TEMPLATES = [
  ["commission_hike", "Careem increased the commission from 20% to 27% last Tuesday without any notice. My take-home has dropped noticeably."],
  ["commission_hike", "Foodpanda quietly bumped commission on peak-hour orders. Earnings per delivery are 15% lower this month."],
  ["deactivation",    "My Bykea account was suddenly deactivated with no reason given. I had a 4.9 rating and 2+ years of history."],
  ["deactivation",    "InDrive suspended me after a single passenger dispute. No chance to present my side before the suspension."],
  ["late_payment",    "Upwork held my payment for 10 days claiming a 'review'. No further detail provided."],
  ["late_payment",    "Foodpanda weekly payout delayed by 5 days this week — second time this month."],
  ["unfair_rating",   "I got a 1-star rating from a passenger because of traffic I couldn't control. Support refused to review it."],
  ["wage_theft",      "The app shows a lower gross than what the customer paid — I verified with the customer's receipt."],
  ["safety",          "Area safety issues after 10pm in a specific Lahore zone — we keep getting routed there."],
  ["working_hours",   "App auto-logs-out after 4 hours claiming rest policy, but the timer doesn't reset properly."],
  ["safety",          "Designer on Fiverr harassing me in DMs. Support closed my ticket without action."],
  ["other",           "New 'service fee' appeared on last week's payout report — no explanation in the app."],
];

// Deterministic PRNG (matches python random.seed(7) roughly — we pick a fixed sequence)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }

async function fetchUsersWithRetry(maxWaitMs = 120_000) {
  const deadline = Date.now() + maxWaitMs;
  let delay = 1000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${AUTH_URL}/auth/users`);
      if (r.ok) {
        const users = await r.json();
        if (users.some((u) => u.role === "worker")) return users;
      }
    } catch (_e) {}
    await new Promise((res) => setTimeout(res, delay));
    delay = Math.min(delay * 1.6, 8000);
  }
  return [];
}

async function seedIfEmpty() {
  if (!ENABLED) return 0;
  const count = db.prepare("SELECT COUNT(*) AS n FROM complaints").get().n;
  if (count > 0) return 0;

  const users = await fetchUsersWithRetry();
  const workers = users.filter((u) => u.role === "worker");
  if (workers.length === 0) {
    console.log("[grievance] auth unavailable; skipping seed");
    return 0;
  }

  const rnd = mulberry32(7);
  const insertComplaint = db.prepare(
    "INSERT INTO complaints(worker_id, platform, category, description, status, moderated, created_at) VALUES (?,?,?,?,?,?,?)"
  );
  const insertTag = db.prepare("INSERT OR IGNORE INTO complaint_tags(complaint_id, tag) VALUES (?,?)");
  const insertCluster = db.prepare("INSERT INTO clusters(label, note) VALUES (?,?)");

  const statusWeights = [
    ["open", 45], ["acknowledged", 20], ["escalated", 20], ["resolved", 15],
  ];
  const pickStatus = (r) => {
    const total = statusWeights.reduce((s, [, w]) => s + w, 0);
    let roll = r() * total;
    for (const [s, w] of statusWeights) { roll -= w; if (roll <= 0) return s; }
    return "open";
  };

  const txn = db.transaction(() => {
    for (let i = 0; i < 60; i++) {
      const w = pick(workers, rnd);
      const [cat, desc] = COMPLAINT_TEMPLATES[Math.floor(rnd() * COMPLAINT_TEMPLATES.length)];
      const platforms = CATEGORIES_PLATFORMS[w.category] || ["Careem"];
      const plat = pick(platforms, rnd);
      const daysAgo = Math.floor(rnd() * 30);
      const created = new Date(Date.now() - daysAgo * 86400e3)
        .toISOString().slice(0, 19).replace("T", " ");
      const status = pickStatus(rnd);
      const moderated = rnd() < 0.55 ? 1 : 0;
      const info = insertComplaint.run(w.id, plat, cat, desc, status, moderated, created);
      const tags = new Set([cat.replace(/_/g, "-")]);
      if (cat.includes("commission")) tags.add("commission-rate");
      if (cat.includes("deactivation")) tags.add("account-safety");
      if (rnd() < 0.3) tags.add("repeat-incident");
      for (const t of tags) insertTag.run(info.lastInsertRowid, t);
    }
    insertCluster.run("Careem – commission hike Q1", "Mid-quarter commission increase complaints");
    insertCluster.run("Bykea – sudden deactivations", "Accounts deactivated without due process");
    db.exec("UPDATE complaints SET cluster_id=1 WHERE platform='Careem' AND category='commission_hike'");
    db.exec("UPDATE complaints SET cluster_id=2 WHERE platform='Bykea' AND category='deactivation'");
  });
  txn();
  return 60;
}

module.exports = { seedIfEmpty };
