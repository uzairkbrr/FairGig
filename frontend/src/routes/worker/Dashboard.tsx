import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell,
} from "recharts";
import { analytics, anomaly, earnings } from "../../api";
import { Banner, Card, EmptyState, SeverityPill, StatCard, fmtPct, fmtRs } from "../../components/UI";
import { useAuth } from "../../auth";
import type { WorkerSummary, Anomaly } from "../../types";

const PLATFORM_COLORS = ["#0fa968", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [median, setMedian] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<{ anomalies: Anomaly[]; weekly_drops: Anomaly[]; summary: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      earnings.summary(user.id),
      user.city ? analytics.cityMedian(user.city, user.category || undefined).catch(() => null) : Promise.resolve(null),
      anomaly.detectFromEarnings(user.id).catch(() => null),
    ]).then(([s, m, a]) => {
      setSummary(s); setMedian(m); setAnomalies(a);
    }).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="text-slate-400 p-8 text-center">loading dashboard…</div>;
  if (err) return <Banner tone="bad">{err}</Banner>;
  if (!summary) return <EmptyState title="No data yet" sub="Log your first shift to see insights" />;

  const { total, weekly, platforms } = summary;
  const myAvgWeekly = weekly.length ? weekly.reduce((s, w) => s + w.net, 0) / weekly.length : 0;
  const median_weekly = median?.median_weekly_net ?? null;
  const medianDelta = median_weekly ? myAvgWeekly - median_weekly : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your earnings</h1>
        <p className="text-sm text-slate-500">{total.shifts} shifts logged · {total.hours.toFixed(1)} hours worked · {user?.city ?? "—"}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Net earnings" value={fmtRs(total.net)} hint={`${fmtRs(total.verified_net)} verified`} />
        <StatCard label="Platform deductions" value={fmtRs(total.deductions)}
                  hint={total.gross > 0 ? fmtPct(total.deductions / total.gross) + " of gross" : undefined}
                  tone={total.gross > 0 && total.deductions / total.gross > 0.25 ? "warn" : "default"} />
        <StatCard label="Effective hourly rate" value={fmtRs(total.effective_hourly_rate) + "/hr"} />
        <StatCard label="Weekly avg (net)" value={fmtRs(Math.round(myAvgWeekly))}
                  hint={median?.suppressed
                    ? "not enough peers yet for comparison"
                    : median_weekly ? `${medianDelta! >= 0 ? "+" : ""}${fmtRs(Math.round(medianDelta!))} vs city median`
                                    : undefined}
                  tone={medianDelta == null ? "default" : medianDelta >= 0 ? "ok" : "warn"} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card title="Weekly net income" className="md:col-span-2">
          {weekly.length < 2 ? (
            <EmptyState title="Log at least two weeks of shifts to see the trend" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weekly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                <Tooltip formatter={(v: number) => fmtRs(v)} />
                <Line type="monotone" dataKey="net" stroke="#0fa968" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="gross" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="City comparison">
          {median?.suppressed ? (
            <div className="text-sm text-slate-500 leading-relaxed">
              Comparison data for <strong>{user?.city}</strong> is withheld — we need at least {3} workers in the same slice before showing a median, to protect individual privacy.
            </div>
          ) : median_weekly ? (
            <>
              <div className="text-3xl font-bold">{fmtRs(median_weekly)}</div>
              <div className="text-xs text-slate-500 mt-1">
                median weekly net · {user?.city}{user?.category ? ` · ${user.category}s` : ""} · n={median.n}
              </div>
              <div className="mt-4 space-y-2">
                <Row label="You" value={fmtRs(Math.round(myAvgWeekly))} highlight />
                <Row label="25th percentile" value={fmtRs(median.p25)} />
                <Row label="Median"         value={fmtRs(median.median_weekly_net)} />
                <Row label="75th percentile" value={fmtRs(median.p75)} />
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Not enough peer data yet for {user?.city}.</div>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Platform breakdown">
          {platforms.length === 0 ? (
            <EmptyState title="Log a shift to see platform-by-platform numbers" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={platforms} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" />
                <XAxis dataKey="platform" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                <Tooltip formatter={(v: number) => fmtRs(v)} />
                <Legend />
                <Bar dataKey="gross" name="Gross" fill="#cbd5e1" />
                <Bar dataKey="deductions" name="Deductions" fill="#fca5a5" />
                <Bar dataKey="net" name="Net">
                  {platforms.map((_, i) => <Cell key={i} fill={PLATFORM_COLORS[i % PLATFORM_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {platforms.map((p) => (
              <div key={p.platform} className="text-xs bg-slate-50 rounded-md px-3 py-2 flex justify-between">
                <span className="font-medium">{p.platform}</span>
                <span className="text-slate-500">commission {fmtPct(p.commission_rate)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="FairGig anomaly watch" action={<div className="text-xs text-slate-500">{anomalies?.summary}</div>}>
          {!anomalies || (anomalies.anomalies.length === 0 && anomalies.weekly_drops.length === 0) ? (
            <EmptyState title="No anomalies flagged" sub="Your shifts look within normal patterns." />
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
              {[...anomalies.anomalies, ...anomalies.weekly_drops].slice(0, 10).map((a, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <SeverityPill severity={a.severity} />
                    <div className="text-xs text-slate-500 uppercase tracking-wider">{a.kind.replace("_", " ")}</div>
                    {a.shift_date && <div className="text-xs text-slate-500 ml-auto">{a.shift_date}</div>}
                  </div>
                  <div className="text-sm mt-2 text-slate-700">{a.message}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm px-2 py-1 rounded ${highlight ? "bg-brand-50 text-brand-700 font-semibold" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
