const express = require("express");
const cors = require("cors");

const db = require("./db");
const { authenticate, requireRole, optionalAuth } = require("./auth");
const { buildClusters, labelFor } = require("./cluster");
const { seedIfEmpty } = require("./seed");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT) || 4004;

// --------------- helpers ---------------
function attachTags(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const tags = db
    .prepare(`SELECT complaint_id, tag FROM complaint_tags WHERE complaint_id IN (${placeholders})`)
    .all(...ids);
  const byId = new Map();
  for (const t of tags) {
    if (!byId.has(t.complaint_id)) byId.set(t.complaint_id, []);
    byId.get(t.complaint_id).push(t.tag);
  }
  return rows.map((r) => ({ ...r, tags: byId.get(r.id) || [] }));
}

function getComplaint(id) {
  const row = db.prepare("SELECT * FROM complaints WHERE id=?").get(id);
  if (!row) return null;
  return attachTags([row])[0];
}

// --------------- routes ---------------
app.get("/healthz", (_req, res) => res.json({ status: "ok", service: "grievance" }));

// Create complaint (worker)
app.post("/complaints", authenticate, (req, res) => {
  if (req.user.role !== "worker") return res.status(403).json({ error: "only workers can file complaints" });
  const { platform, category, description } = req.body || {};
  if (!platform || !category || !description) {
    return res.status(400).json({ error: "platform, category, description required" });
  }
  const info = db
    .prepare(`INSERT INTO complaints (worker_id, platform, category, description) VALUES (?,?,?,?)`)
    .run(Number(req.user.sub), platform, category, description);
  const row = getComplaint(info.lastInsertRowid);
  res.status(201).json(row);
});

// List complaints with filters
app.get("/complaints", optionalAuth, (req, res) => {
  const { platform, category, status, cluster_id, q } = req.query;
  const params = [];
  let sql = "SELECT * FROM complaints WHERE 1=1";
  if (platform) { sql += " AND platform=?"; params.push(platform); }
  if (category) { sql += " AND category=?"; params.push(category); }
  if (status)   { sql += " AND status=?";   params.push(status); }
  if (cluster_id) { sql += " AND cluster_id=?"; params.push(Number(cluster_id)); }
  if (q) { sql += " AND description LIKE ?"; params.push(`%${q}%`); }
  // Workers see only their own + moderated items
  if (req.user && req.user.role === "worker") {
    sql += " AND (worker_id=? OR moderated=1)";
    params.push(Number(req.user.sub));
  }
  sql += " ORDER BY created_at DESC, id DESC LIMIT 500";
  const rows = db.prepare(sql).all(...params);
  res.json(attachTags(rows));
});

// Bulletin (moderated-only) — no auth needed
app.get("/bulletin", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const rows = db
    .prepare("SELECT id,platform,category,description,status,created_at,cluster_id FROM complaints WHERE moderated=1 ORDER BY created_at DESC LIMIT ?")
    .all(limit);
  res.json(attachTags(rows));
});

// Get one
app.get("/complaints/:id", optionalAuth, (req, res) => {
  const row = getComplaint(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "not found" });
  res.json(row);
});

// Update (owner only, pre-escalation)
app.patch("/complaints/:id", authenticate, (req, res) => {
  const row = db.prepare("SELECT * FROM complaints WHERE id=?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "not found" });
  if (Number(req.user.sub) !== row.worker_id)
    return res.status(403).json({ error: "only owner may edit" });
  if (!["open", "acknowledged"].includes(row.status))
    return res.status(409).json({ error: "cannot edit an escalated/resolved complaint" });
  const { description, category } = req.body || {};
  const next = {
    description: description ?? row.description,
    category:    category    ?? row.category,
  };
  db.prepare("UPDATE complaints SET description=?, category=? WHERE id=?")
    .run(next.description, next.category, row.id);
  res.json(getComplaint(row.id));
});

// Delete (owner only, pre-escalation)
app.delete("/complaints/:id", authenticate, (req, res) => {
  const row = db.prepare("SELECT * FROM complaints WHERE id=?").get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: "not found" });
  if (Number(req.user.sub) !== row.worker_id)
    return res.status(403).json({ error: "only owner may delete" });
  if (!["open"].includes(row.status))
    return res.status(409).json({ error: "cannot delete once acknowledged" });
  db.prepare("DELETE FROM complaints WHERE id=?").run(row.id);
  res.status(204).end();
});

// --------------- advocate actions ---------------
app.post("/complaints/:id/tags", authenticate, requireRole("advocate"), (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT 1 FROM complaints WHERE id=?").get(id))
    return res.status(404).json({ error: "not found" });
  const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
  const ins = db.prepare("INSERT OR IGNORE INTO complaint_tags(complaint_id, tag) VALUES (?,?)");
  const txn = db.transaction(() => { for (const t of tags) ins.run(id, String(t).toLowerCase().trim()); });
  txn();
  res.json(getComplaint(id));
});

app.delete("/complaints/:id/tags/:tag", authenticate, requireRole("advocate"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM complaint_tags WHERE complaint_id=? AND tag=?").run(id, req.params.tag);
  res.json(getComplaint(id));
});

app.post("/complaints/:id/moderate", authenticate, requireRole("advocate"), (req, res) => {
  const id = Number(req.params.id);
  const flag = req.body?.moderated === false ? 0 : 1;
  db.prepare("UPDATE complaints SET moderated=? WHERE id=?").run(flag, id);
  res.json(getComplaint(id));
});

app.post("/complaints/:id/escalate", authenticate, requireRole("advocate"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("UPDATE complaints SET status='escalated' WHERE id=?").run(id);
  res.json(getComplaint(id));
});

app.post("/complaints/:id/resolve", authenticate, requireRole("advocate"), (req, res) => {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  db.prepare("UPDATE complaints SET status='resolved' WHERE id=?").run(id);
  if (note) {
    const ins = db.prepare("INSERT OR IGNORE INTO complaint_tags(complaint_id, tag) VALUES (?,?)");
    ins.run(id, `resolution:${String(note).slice(0, 40).toLowerCase().replace(/\s+/g, "_")}`);
  }
  res.json(getComplaint(id));
});

// --------------- clusters ---------------
app.get("/clusters", (_req, res) => {
  const clusters = db.prepare("SELECT * FROM clusters ORDER BY created_at DESC").all();
  const withCount = clusters.map((cl) => {
    const count = db.prepare("SELECT COUNT(*) AS n FROM complaints WHERE cluster_id=?").get(cl.id).n;
    const sample = db.prepare("SELECT id, description, platform, category FROM complaints WHERE cluster_id=? ORDER BY created_at DESC LIMIT 3").all(cl.id);
    return { ...cl, member_count: count, samples: sample };
  });
  res.json(withCount);
});

app.post("/clusters", authenticate, requireRole("advocate"), (req, res) => {
  const { label, note } = req.body || {};
  if (!label) return res.status(400).json({ error: "label required" });
  const info = db.prepare("INSERT INTO clusters(label, note, created_by) VALUES (?,?,?)")
    .run(label, note || null, Number(req.user.sub));
  res.status(201).json(db.prepare("SELECT * FROM clusters WHERE id=?").get(info.lastInsertRowid));
});

app.post("/clusters/:id/members", authenticate, requireRole("advocate"), (req, res) => {
  const clusterId = Number(req.params.id);
  if (!db.prepare("SELECT 1 FROM clusters WHERE id=?").get(clusterId))
    return res.status(404).json({ error: "cluster not found" });
  const ids = Array.isArray(req.body?.complaint_ids) ? req.body.complaint_ids.map(Number) : [];
  const stmt = db.prepare("UPDATE complaints SET cluster_id=? WHERE id=?");
  const txn = db.transaction(() => { for (const id of ids) stmt.run(clusterId, id); });
  txn();
  res.json({ updated: ids.length });
});

app.post("/clusters/auto", authenticate, requireRole("advocate"), (_req, res) => {
  const rows = db.prepare("SELECT * FROM complaints WHERE cluster_id IS NULL").all();
  if (rows.length === 0) return res.json({ created: 0, assigned: 0 });

  const tagRows = db.prepare("SELECT complaint_id, tag FROM complaint_tags").all();
  const tagsBy = new Map();
  for (const t of tagRows) {
    if (!tagsBy.has(t.complaint_id)) tagsBy.set(t.complaint_id, []);
    tagsBy.get(t.complaint_id).push(t.tag);
  }

  const groups = buildClusters(rows, tagsBy);
  const createStmt = db.prepare("INSERT INTO clusters(label, note) VALUES (?,?)");
  const assignStmt = db.prepare("UPDATE complaints SET cluster_id=? WHERE id=?");

  let created = 0, assigned = 0;
  const txn = db.transaction(() => {
    for (const g of groups) {
      const info = createStmt.run(labelFor(g), `auto-clustered from ${g.length} similar complaints`);
      created += 1;
      for (const c of g) { assignStmt.run(info.lastInsertRowid, c.id); assigned += 1; }
    }
  });
  txn();
  res.json({ created, assigned });
});

// --------------- public aggregates ---------------
app.get("/tags", (_req, res) => {
  const rows = db.prepare("SELECT tag, COUNT(*) AS n FROM complaint_tags GROUP BY tag ORDER BY n DESC").all();
  res.json(rows);
});

app.get("/stats/top-categories", (req, res) => {
  const days = Number(req.query.days) || 7;
  const rows = db.prepare(`
    SELECT category, COUNT(*) AS n
    FROM complaints
    WHERE created_at >= datetime('now', ?)
    GROUP BY category ORDER BY n DESC LIMIT 10
  `).all(`-${days} days`);
  res.json(rows);
});

// Internal bulk endpoint for analytics
app.get("/analytics/complaints", (req, res) => {
  const key = req.header("x-internal-key");
  if (key !== (process.env.INTERNAL_KEY || "dev-fairgig-internal")) {
    return res.status(401).json({ error: "bad internal key" });
  }
  const rows = db.prepare("SELECT * FROM complaints").all();
  res.json(attachTags(rows));
});

// error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[grievance] listening on :${PORT}`);
  // Fire-and-forget: /healthz responds while seeding runs in background.
  seedIfEmpty()
    .then((n) => { if (n) console.log(`[grievance] seeded ${n} complaints`); })
    .catch((e) => console.error("[grievance] seed failed:", e));
});
