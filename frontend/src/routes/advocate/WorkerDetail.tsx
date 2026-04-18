import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { auth, earnings, anomaly, certificate } from "../../api";
import { Banner, Card, EmptyState, SeverityPill, StatCard, StatusPill, fmtPct, fmtRs } from "../../components/UI";
import type { Shift, User, WorkerSummary, Anomaly } from "../../types";

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const workerId = Number(id);
  const [worker, setWorker] = useState<User | null>(null);
  const [summary, setSummary] = useState<WorkerSummary | null>(null);
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [anomalies, setAnomalies] = useState<{ anomalies: Anomaly[]; weekly_drops: Anomaly[]; summary: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      auth.user(workerId),
      earnings.summary(workerId),
      earnings.listWorker(workerId),
      anomaly.detectFromEarnings(workerId).catch(() => null),
    ]).then(([u, s, sh, a]) => {
      setWorker(u); setSummary(s); setShifts(sh); setAnomalies(a);
    }).catch((e) => setErr(e.message));
  }, [workerId]);

  if (err) return <Banner tone="bad">{err}</Banner>;
  if (!worker || !summary || !shifts) return <div className="text-slate-400 p-8 text-center">loading…</div>;

  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="text-sm"><Link to="/advocate/workers" className="text-slate-500 hover:underline">← all workers</Link></div>
          <h1 className="text-2xl font-bold mt-1">{worker.name}</h1>
          <div className="text-sm text-slate-500">{worker.role} · {worker.city ?? "—"} · {worker.category ?? "—"} · {worker.email}</div>
        </div>
        <a className="btn-secondary self-start" target="_blank" rel="noreferrer" href={certificate.url(workerId, ninetyDaysAgo, today)}>Open certificate</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Shifts" value={summary.total.shifts} />
        <StatCard label="Net earnings" value={fmtRs(summary.total.net)} hint={`${fmtRs(summary.total.verified_net)} verified`} />
        <StatCard label="Effective hourly rate" value={fmtRs(summary.total.effective_hourly_rate) + "/hr"} />
        <StatCard label="Hours worked" value={summary.total.hours.toFixed(1)} />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card title="Weekly net income" className="md:col-span-2">
          {summary.weekly.length < 2 ? <EmptyState title="Not enough weeks" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={summary.weekly}>
                <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${Math.round(v/1000)}k`} />
                <Tooltip formatter={(v: number) => fmtRs(v)} />
                <Line type="monotone" dataKey="net" stroke="#0fa968" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Anomaly watch" action={<div className="text-xs text-slate-500">{anomalies?.summary}</div>}>
          {!anomalies || (anomalies.anomalies.length === 0 && anomalies.weekly_drops.length === 0) ? (
            <EmptyState title="No anomalies" />
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-auto">
              {[...anomalies.anomalies, ...anomalies.weekly_drops].slice(0, 8).map((a, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <SeverityPill severity={a.severity} />
                    <div className="text-xs text-slate-500 uppercase tracking-wider">{a.kind.replace("_"," ")}</div>
                    {a.shift_date && <div className="text-xs text-slate-500 ml-auto">{a.shift_date}</div>}
                  </div>
                  <div className="text-sm mt-2 text-slate-700">{a.message}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title={`Shifts (${shifts.length})`}>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Platform</th>
              <th className="py-2 pr-3 text-right">Hours</th>
              <th className="py-2 pr-3 text-right">Gross</th>
              <th className="py-2 pr-3 text-right">Ded.</th>
              <th className="py-2 pr-3 text-right">Comm.</th>
              <th className="py-2 pr-3 text-right">Net</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium">{s.shift_date}</td>
                <td className="py-2 pr-3">{s.platform}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{s.hours.toFixed(1)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(s.gross)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(s.deductions)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{s.gross > 0 ? fmtPct(s.deductions / s.gross) : "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-semibold">{fmtRs(s.net)}</td>
                <td className="py-2 pr-3"><StatusPill status={s.verification_status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
