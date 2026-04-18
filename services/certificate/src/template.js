const fmtRs = (n) => "Rs. " + Number(n).toLocaleString("en-PK");
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function render({ worker, range, totals, perPlatform, shifts, stamp, generatedAt }) {
  const rows = shifts
    .map(
      (s) => `
      <tr>
        <td>${escapeHtml(s.shift_date)}</td>
        <td>${escapeHtml(s.platform)}</td>
        <td class="num">${Number(s.hours).toFixed(1)}</td>
        <td class="num">${fmtRs(s.gross)}</td>
        <td class="num">${fmtRs(s.deductions)}</td>
        <td class="num">${fmtRs(s.net)}</td>
        <td><span class="pill pill-${s.verification_status}">${escapeHtml(s.verification_status)}</span></td>
      </tr>`
    )
    .join("");

  const platformRows = perPlatform
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(p.platform)}</td>
        <td class="num">${p.shifts}</td>
        <td class="num">${p.hours.toFixed(1)}</td>
        <td class="num">${fmtRs(p.gross)}</td>
        <td class="num">${fmtRs(p.deductions)}</td>
        <td class="num">${fmtRs(p.net)}</td>
        <td class="num">${(p.commission_rate * 100).toFixed(1)}%</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>FairGig Income Certificate — ${escapeHtml(worker.name)}</title>
<style>
  :root { color-scheme: only light; }
  html, body { margin: 0; padding: 0; background: #eef1f6; color: #111; font: 14px/1.5 "Inter","Segoe UI",system-ui,sans-serif; }
  .page { max-width: 820px; margin: 24px auto; background: #fff; padding: 48px 56px; box-shadow: 0 2px 12px rgba(0,0,0,.08); border-radius: 10px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 18px; margin-bottom: 26px; }
  .brand { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
  .brand span { color: #0a7; }
  .meta { text-align: right; font-size: 12px; color: #555; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  h2 { font-size: 16px; margin: 28px 0 8px; letter-spacing: .02em; text-transform: uppercase; color: #333; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 18px 0 12px; }
  .card { background: #f7f8fa; border: 1px solid #e6e8ee; border-radius: 8px; padding: 14px; }
  .card .label { font-size: 11px; text-transform: uppercase; color: #777; letter-spacing: .05em; }
  .card .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #eceef3; text-align: left; }
  th { background: #f4f6fa; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #555; letter-spacing: .04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .pill-verified     { background: #dcfce7; color: #166534; }
  .pill-pending      { background: #fef3c7; color: #92400e; }
  .pill-flagged      { background: #fee2e2; color: #991b1b; }
  .pill-unverifiable { background: #e5e7eb; color: #374151; }
  .stamp { margin-top: 36px; padding-top: 18px; border-top: 1px dashed #bbb; font-size: 11px; color: #555; word-break: break-all; }
  .stamp code { background: #f4f6fa; padding: 3px 6px; border-radius: 4px; }
  .disclaimer { margin-top: 18px; font-size: 11px; color: #777; }
  .noprint { position: fixed; right: 24px; top: 24px; }
  .noprint button { background: #111; color: #fff; border: 0; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,.15); }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; max-width: none; padding: 24px 32px; border-radius: 0; }
    .noprint { display: none; }
    h2 { page-break-after: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <header>
    <div>
      <div class="brand">Fair<span>Gig</span></div>
      <div style="font-size:12px;color:#666;margin-top:4px;">Gig Worker Income &amp; Rights Platform — Pakistan</div>
    </div>
    <div class="meta">
      Generated ${escapeHtml(generatedAt)}<br/>
      Period ${escapeHtml(range.from)} → ${escapeHtml(range.to)}
    </div>
  </header>

  <h1>Income Certificate</h1>
  <div>This certifies that <strong>${escapeHtml(worker.name)}</strong>${worker.city ? ` (${escapeHtml(worker.city)})` : ""} logged the earnings summarised below on the FairGig platform. Individual shifts with <em>verified</em> status were reviewed against platform earnings screenshots by an independent FairGig verifier.</div>

  <div class="grid">
    <div class="card"><div class="label">Total net earnings</div><div class="value">${fmtRs(totals.net)}</div></div>
    <div class="card"><div class="label">Verified net earnings</div><div class="value">${fmtRs(totals.verified_net)}</div></div>
    <div class="card"><div class="label">Shifts logged</div><div class="value">${totals.shifts}</div></div>
    <div class="card"><div class="label">Hours worked</div><div class="value">${totals.hours.toFixed(1)}</div></div>
    <div class="card"><div class="label">Gross earnings</div><div class="value">${fmtRs(totals.gross)}</div></div>
    <div class="card"><div class="label">Platform deductions</div><div class="value">${fmtRs(totals.deductions)}</div></div>
  </div>

  <h2>By platform</h2>
  <table>
    <thead><tr>
      <th>Platform</th><th class="num">Shifts</th><th class="num">Hours</th>
      <th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th><th class="num">Commission</th>
    </tr></thead>
    <tbody>${platformRows || '<tr><td colspan="7" style="color:#888;text-align:center;padding:18px">No shifts in this range</td></tr>'}</tbody>
  </table>

  <h2>Shift-by-shift detail</h2>
  <table>
    <thead><tr>
      <th>Date</th><th>Platform</th><th class="num">Hours</th>
      <th class="num">Gross</th><th class="num">Deductions</th><th class="num">Net</th><th>Status</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="7" style="color:#888;text-align:center;padding:18px">No shifts in this range</td></tr>'}</tbody>
  </table>

  <div class="stamp">
    <strong>Verification stamp</strong> — this certificate was rendered by the FairGig certificate service on ${escapeHtml(generatedAt)}. Paste the stamp below into <code>POST /verify</code> to confirm authenticity: <br/><br/>
    <code>${escapeHtml(stamp)}</code>
  </div>
  <div class="disclaimer">
    FairGig certifies what was logged and what a verifier reviewed. Shifts marked <em>pending</em> have been logged by the worker but not yet confirmed against platform screenshots. This document is provided in good faith and is not a substitute for a formal payslip issued by the gig platform.
  </div>
</div>
</body>
</html>`;
}

module.exports = { render };
