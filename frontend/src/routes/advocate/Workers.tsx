import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../api";
import { Banner, Card, EmptyState } from "../../components/UI";
import type { User } from "../../types";

export default function AdvocateWorkers() {
  const [workers, setWorkers] = useState<User[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    auth.listUsers("worker").then(setWorkers).catch((e) => setErr(e.message));
  }, []);

  const visible = (workers || []).filter((w) =>
    [w.name, w.email, w.city, w.category].join(" ").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold">Workers</h1>
        <input className="input sm:max-w-xs" placeholder="Search name / city / category"
               value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {err && <Banner tone="bad">{err}</Banner>}
      {!workers ? <div className="text-slate-400">loading…</div> :
       visible.length === 0 ? <EmptyState title="No workers match" /> : (
        <Card>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2 pr-3 font-semibold">{w.name}</td>
                  <td className="py-2 pr-3 text-slate-600">{w.email}</td>
                  <td className="py-2 pr-3">{w.city ?? "—"}</td>
                  <td className="py-2 pr-3">{w.category ?? "—"}</td>
                  <td className="py-2 pr-3 text-right">
                    <Link to={`/advocate/workers/${w.id}`} className="text-brand-600 hover:underline">profile →</Link>
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
