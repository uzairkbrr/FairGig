import { FormEvent, useState } from "react";
import { earnings } from "../../api";
import { Banner, Card, Field, fmtRs } from "../../components/UI";
import { useNavigate } from "react-router-dom";

const PLATFORMS = ["Careem", "Bykea", "Foodpanda", "InDrive", "Uber", "Upwork", "Fiverr", "Other"];

export default function LogShift() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    platform: "Careem", shift_date: new Date().toISOString().slice(0, 10),
    hours: "8", gross: "4000", deductions: "800", net: "3200", note: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  const net = Number(form.gross) - Number(form.deductions);

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null); setOk(null); setLoading(true);
    try {
      const r = await earnings.create({
        platform: form.platform, shift_date: form.shift_date,
        hours: Number(form.hours), gross: Number(form.gross),
        deductions: Number(form.deductions),
        net: Number(form.net) || net,
        note: form.note || undefined,
      });
      setOk(`Logged shift #${r.id} — ${fmtRs(r.net)} net`);
      setTimeout(() => nav("/shifts"), 900);
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  const importCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImportLoading(true); setCsvResult(null);
    try {
      const r = await earnings.importCsv(f);
      setCsvResult(`Imported ${r.created} shifts from CSV${r.errors.length ? ` (${r.errors.length} errors)` : ""}.`);
    } catch (e: any) {
      setCsvResult(`Import failed: ${e.message}`);
    } finally { setImportLoading(false); }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card title="Log a shift" className="md:col-span-2">
        {err && <div className="mb-3"><Banner tone="bad">{err}</Banner></div>}
        {ok && <div className="mb-3"><Banner tone="ok">{ok}</Banner></div>}
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Platform">
            <select className="input" value={form.platform} onChange={update("platform")}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Shift date">
            <input type="date" className="input" value={form.shift_date} onChange={update("shift_date")} required />
          </Field>
          <Field label="Hours worked">
            <input type="number" step="0.5" min="0.5" className="input" value={form.hours} onChange={update("hours")} required />
          </Field>
          <Field label="Gross earnings (Rs.)" hint="Before platform deductions">
            <input type="number" min="0" className="input" value={form.gross} onChange={update("gross")} required />
          </Field>
          <Field label="Platform deductions (Rs.)" hint="Commission, cancellation fees, taxes">
            <input type="number" min="0" className="input" value={form.deductions} onChange={update("deductions")} required />
          </Field>
          <Field label="Net received (Rs.)" hint={`suggested: ${fmtRs(net)}`}>
            <input type="number" min="0" className="input" value={form.net} onChange={update("net")} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note (optional)">
              <textarea className="input" rows={2} value={form.note} onChange={update("note") as any} />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary" disabled={loading}>{loading ? "Saving…" : "Log shift"}</button>
          </div>
        </form>
      </Card>

      <Card title="Bulk CSV import">
        <p className="text-sm text-slate-600 mb-3">For tech-savvy users. CSV columns: <code>platform, shift_date, hours, gross, deductions, net</code>.</p>
        <label className="btn-secondary cursor-pointer w-full justify-center">
          {importLoading ? "Importing…" : "Upload CSV"}
          <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
        </label>
        {csvResult && <div className="mt-3"><Banner tone={csvResult.startsWith("Import failed") ? "bad" : "ok"}>{csvResult}</Banner></div>}
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer">sample.csv</summary>
          <pre className="mt-2 p-3 bg-slate-50 rounded overflow-x-auto">
{`platform,shift_date,hours,gross,deductions,net
Careem,2026-03-01,8.5,4200,900,3300
Foodpanda,2026-03-02,5,1800,380,1420
`}
          </pre>
        </details>
      </Card>
    </div>
  );
}
