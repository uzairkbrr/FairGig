import { useEffect, useState } from "react";
import { grievance } from "../../api";
import { Banner, Card, EmptyState, StatusPill } from "../../components/UI";
import type { Complaint } from "../../types";

export default function AdvocateGrievances() {
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [clusters, setClusters] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [tagDraft, setTagDraft] = useState<Record<number, string>>({});

  const reload = () => {
    grievance.list().then(setItems).catch((e) => setErr(e.message));
    grievance.clusters().then(setClusters).catch(() => setClusters([]));
  };
  useEffect(reload, []);

  const addTag = async (id: number) => {
    const raw = (tagDraft[id] || "").trim();
    if (!raw) return;
    const tags = raw.split(",").map((s) => s.trim()).filter(Boolean);
    await grievance.addTags(id, tags);
    setTagDraft({ ...tagDraft, [id]: "" });
    reload();
  };

  const doAction = async (id: number, fn: () => Promise<unknown>) => {
    setBusy(id);
    try { await fn(); reload(); } catch (e: any) { setErr(e.message); }
    finally { setBusy(null); }
  };

  const visible = (items || []).filter((c) =>
    filter === "all" ? true : c.status === filter
  );

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-2xl font-bold">Grievance board</h1>
          <select className="input sm:max-w-[180px]" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        {err && <Banner tone="bad">{err}</Banner>}

        {!items ? <div className="text-slate-400">loading…</div> :
         visible.length === 0 ? <EmptyState title="No complaints" /> :
         visible.map((c) => (
           <Card key={c.id}>
             <div className="flex items-start gap-4">
               <div className="flex-1">
                 <div className="flex flex-wrap items-center gap-2">
                   <span className="font-semibold">{c.platform}</span>
                   <span className="text-xs text-slate-500">{c.category.replace("_"," ")}</span>
                   <StatusPill status={c.status} />
                   {c.moderated === 1 && <span className="pill bg-sky-100 text-sky-700">public</span>}
                   {c.cluster_id && <span className="pill bg-purple-100 text-purple-700">cluster #{c.cluster_id}</span>}
                   <span className="text-xs text-slate-400 ml-auto">#{c.id} · {new Date(c.created_at).toLocaleDateString()}</span>
                 </div>
                 <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{c.description}</div>

                 {c.tags?.length > 0 && (
                   <div className="flex gap-1 flex-wrap mt-2">
                     {c.tags.map((t) => (
                       <span key={t} className="pill bg-slate-100 text-slate-700 group relative">
                         {t}
                         <button className="ml-1 text-red-500 opacity-60 hover:opacity-100"
                                 onClick={() => doAction(c.id, () => grievance.removeTag(c.id, t))}>×</button>
                       </span>
                     ))}
                   </div>
                 )}

                 <div className="flex items-center gap-2 mt-3">
                   <input className="input max-w-xs" placeholder="add tags (comma-separated)"
                          value={tagDraft[c.id] || ""} onChange={(e) => setTagDraft({ ...tagDraft, [c.id]: e.target.value })} />
                   <button className="btn-secondary text-xs" onClick={() => addTag(c.id)}>Add tags</button>
                 </div>

                 <div className="flex flex-wrap gap-2 mt-3">
                   {c.moderated === 0 ? (
                     <button className="btn-secondary text-xs" disabled={busy === c.id} onClick={() => doAction(c.id, () => grievance.moderate(c.id, true))}>Publish on bulletin</button>
                   ) : (
                     <button className="btn-ghost text-xs" disabled={busy === c.id} onClick={() => doAction(c.id, () => grievance.moderate(c.id, false))}>Unpublish</button>
                   )}
                   {c.status !== "escalated" && c.status !== "resolved" && (
                     <button className="btn-danger text-xs" disabled={busy === c.id} onClick={() => doAction(c.id, () => grievance.escalate(c.id))}>Escalate</button>
                   )}
                   {c.status !== "resolved" && (
                     <button className="btn-primary text-xs" disabled={busy === c.id} onClick={() => doAction(c.id, () => grievance.resolve(c.id))}>Mark resolved</button>
                   )}
                 </div>
               </div>
             </div>
           </Card>
         ))
        }
      </div>

      <div className="md:col-span-1 space-y-4">
        <Card title="Clusters" action={
          <button className="btn-secondary text-xs" onClick={async () => {
            const r = await grievance.autoCluster();
            alert(`Auto-clustered: created ${r.created} clusters, assigned ${r.assigned} complaints.`);
            reload();
          }}>Auto-cluster</button>
        }>
          {!clusters || clusters.length === 0 ? (
            <EmptyState title="No clusters yet" sub="Click Auto-cluster to group similar complaints" />
          ) : (
            <div className="space-y-2">
              {clusters.map((cl) => (
                <div key={cl.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{cl.label}</div>
                    <span className="pill bg-purple-100 text-purple-700">{cl.member_count} complaints</span>
                  </div>
                  {cl.note && <div className="text-xs text-slate-500 mt-1">{cl.note}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
