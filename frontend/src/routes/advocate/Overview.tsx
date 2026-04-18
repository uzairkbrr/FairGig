import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { analytics } from "../../api";
import { Banner, Card, EmptyState, StatCard, fmtPct, fmtRs } from "../../components/UI";
import { Link } from "react-router-dom";

const PLATFORM_COLORS = ["#0fa968", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];

export default function AdvocateOverview() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    analytics.overview().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Banner tone="bad">{err}</Banner>;
  if (!data) return <div className="text-slate-400 p-8 text-center">loading analytics…</div>;

  const trendData = (() => {
    if (!data.commission_trends?.weeks) return [];
    const weeks: string[] = data.commission_trends.weeks;
    return weeks.map((w) => {
      const row: any = { week: w };
      for (const series of data.commission_trends.series) {
        const point = series.points.find((p: any) => p.week === w);
        if (point) row[series.platform] = point.avg_commission * 100; // %
      }
      return row;
    });
  })();
  const platforms: string[] = data.commission_trends?.series?.map((s: any) => s.platform) ?? [];

  const topCats = data.top_complaints?.categories ?? [];
  const zones = data.income_distribution?.zones ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advocate overview</h1>
        <p className="text-sm text-slate-500">Systemic trends across the platform, refreshed every {20}s.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Shifts logged"    value={data.kpis.total_shifts_logged} />
        <StatCard label="Verified shifts"  value={data.kpis.total_verified_shifts} tone="ok" />
        <StatCard label="Complaints"       value={data.kpis.total_complaints} />
        <StatCard label="Escalated"        value={data.kpis.escalated_complaints} tone="warn" />
        <StatCard label="Vulnerable workers" value={data.kpis.vulnerable_workers} hint=">20% MoM income drop" tone="bad" />
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        <Card title="Commission-rate trends (weekly avg, %)" className="md:col-span-3">
          {trendData.length < 2 ? (
            <EmptyState title="Not enough weeks of data" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                <Legend />
                {platforms.map((p, i) => (
                  <Line key={p} type="monotone" dataKey={p} stroke={PLATFORM_COLORS[i % PLATFORM_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Top complaint categories (7d)" className="md:col-span-2">
          {topCats.length === 0 ? (
            <EmptyState title="No complaints this week" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topCats} layout="vertical">
                <CartesianGrid stroke="#eef2f6" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} width={120} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        <Card title="Income distribution by city zone" className="md:col-span-3">
          {zones.length === 0 ? (
            <EmptyState title="No income data yet" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Zone</th>
                  <th className="py-2 pr-3 text-right">n</th>
                  <th className="py-2 pr-3 text-right">p25</th>
                  <th className="py-2 pr-3 text-right">median</th>
                  <th className="py-2 pr-3 text-right">p75</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z: any) => (
                  <tr key={z.zone} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium">{z.zone}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{z.n}</td>
                    {z.suppressed ? (
                      <td colSpan={3} className="py-2 pr-3 text-center text-slate-400 italic text-xs">suppressed (k-anonymity floor)</td>
                    ) : (
                      <>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(z.p25)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold">{fmtRs(z.median)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(z.p75)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={`Vulnerability flag (${data.vulnerable_workers.flagged.length})`} className="md:col-span-2"
              action={<span className="text-xs text-slate-500">≥20% MoM drop</span>}>
          {data.vulnerable_workers.flagged.length === 0 ? (
            <EmptyState title="No workers flagged" sub="Nobody dropped more than 20% MoM" />
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-auto">
              {data.vulnerable_workers.flagged.map((w: any) => (
                <Link to={`/advocate/workers/${w.worker_id}`} key={w.worker_id}
                      className="flex items-center justify-between rounded-lg p-3 bg-red-50 border border-red-100 hover:bg-red-100 transition">
                  <div>
                    <div className="font-semibold text-red-900">{w.name}</div>
                    <div className="text-xs text-red-700/80">{w.city} · {w.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-700">−{fmtPct(w.drop_pct)}</div>
                    <div className="text-[11px] text-red-600/70">{fmtRs(w.last_30d_net)} / {fmtRs(w.prev_30d_net)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
