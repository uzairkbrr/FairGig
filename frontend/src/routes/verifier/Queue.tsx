import { useEffect, useState } from "react";
import { auth as authApi, earnings } from "../../api";
import { Banner, Card, EmptyState, Field, fmtPct, fmtRs } from "../../components/UI";
import type { Shift, User } from "../../types";

export default function VerifierQueue() {
  const [items, setItems] = useState<Shift[] | null>(null);
  const [workers, setWorkers] = useState<Record<number, User>>({});
  const [selected, setSelected] = useState<Shift | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    try {
      const list = await earnings.listPending();
      setItems(list);
      if (list.length === 0) setSelected(null);
      else if (!list.find((x) => x.id === selected?.id)) setSelected(list[0]);
      // fetch worker names lazily
      const unique = [...new Set(list.map((s) => s.worker_id))];
      const missing = unique.filter((id) => !workers[id]);
      const fetched = await Promise.all(missing.map((id) => authApi.user(id).catch(() => null)));
      const next = { ...workers };
      fetched.forEach((u) => { if (u) next[u.id] = u; });
      setWorkers(next);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-line */ }, []);

  const decide = async (action: "verified" | "flagged" | "unverifiable") => {
    if (!selected) return;
    setBusy(true);
    try {
      await earnings.verify(selected.id, action, note || undefined);
      setNote("");
      await reload();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  if (!items) return <div className="text-slate-400 p-8 text-center">loading…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Verification queue</h1>
        <p className="text-sm text-slate-500">{items.length} shifts awaiting review. Compare the uploaded screenshot against the logged numbers and choose an outcome.</p>
      </div>
      {err && <Banner tone="bad">{err}</Banner>}

      {items.length === 0 ? (
        <EmptyState title="Queue is empty" sub="All pending screenshots have been reviewed." />
      ) : (
        <div className="grid md:grid-cols-12 gap-4">
          <aside className="md:col-span-4 space-y-2">
            {items.map((s) => {
              const worker = workers[s.worker_id];
              const active = selected?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left card p-3 transition ${active ? "ring-2 ring-brand-500" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{worker?.name ?? `Worker #${s.worker_id}`}</div>
                    <div className="text-xs text-slate-400">{s.shift_date}</div>
                  </div>
                  <div className="text-xs text-slate-500">{s.platform} · {s.hours}h · {fmtRs(s.net)} net</div>
                  {s.gross > 0 && s.deductions / s.gross > 0.3 && (
                    <div className="text-[11px] text-amber-700 mt-1">commission {fmtPct(s.deductions / s.gross)} — high</div>
                  )}
                </button>
              );
            })}
          </aside>

          <section className="md:col-span-8">
            {selected ? (
              <Card title={`Shift #${selected.id}`}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">Logged by</div>
                    <div className="font-semibold">{workers[selected.worker_id]?.name ?? `Worker #${selected.worker_id}`}</div>
                    <div className="text-sm text-slate-500">{workers[selected.worker_id]?.city} · {workers[selected.worker_id]?.category}</div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-slate-500">Platform</dt><dd className="font-semibold">{selected.platform}</dd></div>
                      <div><dt className="text-xs text-slate-500">Date</dt><dd className="font-semibold">{selected.shift_date}</dd></div>
                      <div><dt className="text-xs text-slate-500">Hours</dt><dd className="font-semibold">{selected.hours}</dd></div>
                      <div><dt className="text-xs text-slate-500">Commission</dt><dd className="font-semibold">{selected.gross > 0 ? fmtPct(selected.deductions / selected.gross) : "—"}</dd></div>
                      <div><dt className="text-xs text-slate-500">Gross</dt><dd className="font-semibold tabular-nums">{fmtRs(selected.gross)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Deductions</dt><dd className="font-semibold tabular-nums">{fmtRs(selected.deductions)}</dd></div>
                      <div><dt className="text-xs text-slate-500">Net</dt><dd className="font-semibold tabular-nums">{fmtRs(selected.net)}</dd></div>
                    </dl>

                    <div className="mt-5">
                      <Field label="Note (optional)">
                        <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. numbers match screenshot" />
                      </Field>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="btn-primary" disabled={busy} onClick={() => decide("verified")}>Verify</button>
                      <button className="btn-danger" disabled={busy} onClick={() => decide("flagged")}>Flag discrepancy</button>
                      <button className="btn-ghost" disabled={busy} onClick={() => decide("unverifiable")}>Unverifiable</button>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Screenshot</div>
                    {selected.screenshot_path ? (
                      <a href={earnings.screenshotUrl(selected.screenshot_path)} target="_blank" rel="noreferrer" className="block">
                        <img src={earnings.screenshotUrl(selected.screenshot_path)}
                             alt="screenshot" className="rounded-lg border border-slate-200 max-h-96 object-contain w-full bg-slate-50" />
                        <div className="text-[11px] text-slate-500 mt-1">click to open full size</div>
                      </a>
                    ) : (
                      <EmptyState title="No screenshot attached" />
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <EmptyState title="Select a shift from the queue" />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
