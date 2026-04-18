import { FormEvent, useEffect, useState } from "react";
import { grievance } from "../../api";
import { Banner, Card, EmptyState, Field, StatusPill } from "../../components/UI";
import type { Complaint } from "../../types";

const CATEGORIES = [
  "commission_hike", "deactivation", "late_payment", "unfair_rating",
  "safety", "working_hours", "wage_theft", "other",
];
const PLATFORMS = ["Careem", "Bykea", "Foodpanda", "InDrive", "Uber", "Upwork", "Fiverr"];

export default function WorkerGrievance() {
  const [mine, setMine] = useState<Complaint[] | null>(null);
  const [bulletin, setBulletin] = useState<Complaint[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ platform: "Careem", category: "commission_hike", description: "" });
  const [tab, setTab] = useState<"mine" | "bulletin">("mine");

  const reload = () => {
    grievance.list().then(setMine).catch((e) => setErr(e.message));
    grievance.bulletin().then(setBulletin).catch(() => setBulletin([]));
  };

  useEffect(reload, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await grievance.create(form);
      setForm({ ...form, description: "" });
      reload();
    } catch (e: any) { setErr(e.message); }
  };

  const update = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const visible = tab === "mine" ? (mine ?? []).filter((c) => c.moderated === 0 || c.worker_id) : (bulletin ?? []);

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <Card title="File a complaint" className="md:col-span-1">
        <form onSubmit={submit} className="space-y-3">
          {err && <Banner tone="bad">{err}</Banner>}
          <Field label="Platform">
            <select className="input" value={form.platform} onChange={update("platform")}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className="input" value={form.category} onChange={update("category")}>
              {CATEGORIES.map((c) => <option key={c}>{c.replace("_"," ")}</option>)}
            </select>
          </Field>
          <Field label="Description" hint="Anonymised on the public bulletin after moderation">
            <textarea className="input" rows={4} value={form.description} onChange={update("description") as any} required />
          </Field>
          <button className="btn-primary w-full justify-center">Submit complaint</button>
        </form>
      </Card>

      <div className="md:col-span-2 space-y-4">
        <div className="flex gap-2">
          <button
            className={`btn-ghost ${tab === "mine" ? "!bg-slate-900 !text-white" : ""}`}
            onClick={() => setTab("mine")}
          >My complaints</button>
          <button
            className={`btn-ghost ${tab === "bulletin" ? "!bg-slate-900 !text-white" : ""}`}
            onClick={() => setTab("bulletin")}
          >Public bulletin</button>
        </div>

        {visible.length === 0 ? (
          <EmptyState title={tab === "mine" ? "No complaints filed yet" : "No moderated posts yet"} />
        ) : (
          <div className="space-y-2">
            {visible.map((c) => (
              <Card key={c.id}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{c.platform}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{c.category.replace("_", " ")}</span>
                      <StatusPill status={c.status} />
                      {c.moderated === 1 && <span className="pill bg-sky-100 text-sky-700">public</span>}
                    </div>
                    <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{c.description}</div>
                    {c.tags?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {c.tags.map((t) => <span key={t} className="pill bg-slate-100 text-slate-700">{t}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">{new Date(c.created_at).toLocaleDateString()}</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
