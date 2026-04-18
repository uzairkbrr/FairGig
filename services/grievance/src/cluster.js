/**
 * Lightweight auto-clustering: group complaints by shared tags (and by
 * platform+category as a fallback). Each connected component of
 * (complaint shares >= 1 tag with another complaint) becomes a cluster.
 */
function buildClusters(complaints, tagsByComplaint) {
  const parent = new Map();
  const find = (x) => {
    let p = parent.get(x);
    if (p === undefined || p === x) return x;
    p = find(p);
    parent.set(x, p);
    return p;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const c of complaints) parent.set(c.id, c.id);

  // group by tag
  const byTag = new Map();
  for (const c of complaints) {
    const tags = tagsByComplaint.get(c.id) || [];
    for (const t of tags) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(c.id);
    }
  }
  for (const ids of byTag.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }

  // fallback: same platform AND category pairs unify with a pseudo-tag
  const byPC = new Map();
  for (const c of complaints) {
    const key = `${c.platform}::${c.category}`;
    if (!byPC.has(key)) byPC.set(key, []);
    byPC.get(key).push(c.id);
  }
  for (const [, ids] of byPC) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }

  const groups = new Map();
  for (const c of complaints) {
    const r = find(c.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c);
  }
  return [...groups.values()].filter((g) => g.length >= 2);
}

function labelFor(group) {
  const platformCounts = new Map();
  const categoryCounts = new Map();
  for (const c of group) {
    platformCounts.set(c.platform, (platformCounts.get(c.platform) || 0) + 1);
    categoryCounts.set(c.category, (categoryCounts.get(c.category) || 0) + 1);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return `${top(platformCounts)} – ${top(categoryCounts)}`;
}

module.exports = { buildClusters, labelFor };
