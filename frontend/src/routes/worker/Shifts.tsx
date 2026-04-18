import { useEffect, useRef, useState } from "react";
import { earnings } from "../../api";
import { Banner, Card, EmptyState, StatusPill, fmtPct, fmtRs } from "../../components/UI";
import type { Shift } from "../../types";

export default function MyShifts() {
  const [shifts, setShifts] = useState<Shift[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () =>
    earnings.listMine().then(setShifts).catch((e) => setErr(e.message));

  useEffect(() => { reload(); }, []);

  const triggerUpload = (shiftId: number) => {
    setUploadingFor(shiftId);
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || uploadingFor == null) return;
    try {
      await earnings.uploadScreenshot(uploadingFor, f);
      await reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setUploadingFor(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this shift?")) return;
    try {
      await earnings.remove(id);
      setShifts((s) => s?.filter((x) => x.id !== id) ?? null);
    } catch (e: any) { setErr(e.message); }
  };

  if (!shifts) return <div className="text-slate-400 p-8 text-center">loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My shifts</h1>
        <div className="text-sm text-slate-500">{shifts.length} total</div>
      </div>
      {err && <Banner tone="bad">{err}</Banner>}
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} />

      {shifts.length === 0 ? (
        <EmptyState title="No shifts yet" sub="Log your first shift to see it here" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3 text-right">Hours</th>
                <th className="py-2 pr-3 text-right">Gross</th>
                <th className="py-2 pr-3 text-right">Deductions</th>
                <th className="py-2 pr-3 text-right">Commission</th>
                <th className="py-2 pr-3 text-right">Net</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Screenshot</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-3 font-medium">{s.shift_date}</td>
                  <td className="py-2 pr-3">{s.platform}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{s.hours.toFixed(1)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(s.gross)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtRs(s.deductions)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-500">
                    {s.gross > 0 ? fmtPct(s.deductions / s.gross) : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">{fmtRs(s.net)}</td>
                  <td className="py-2 pr-3"><StatusPill status={s.verification_status} /></td>
                  <td className="py-2 pr-3">
                    {s.screenshot_path ? (
                      <a href={earnings.screenshotUrl(s.screenshot_path)} target="_blank" rel="noreferrer"
                         className="text-brand-600 hover:underline text-xs">view</a>
                    ) : (
                      <button className="text-xs text-slate-500 hover:text-slate-800" onClick={() => triggerUpload(s.id)}>upload</button>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    {s.verification_status === "pending" && (
                      <button onClick={() => remove(s.id)} className="text-xs text-red-600 hover:underline">delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}
    </div>
  );
}
