import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { certificate } from "../../api";
import { Card, Field, Banner } from "../../components/UI";

export default function Certificate() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10);
  const [from, setFrom] = useState(threeMonthsAgo);
  const [to, setTo] = useState(today);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  if (!user) return null;
  const url = certificate.url(user.id, from, to, verifiedOnly);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Income certificate</h1>
        <p className="text-sm text-slate-500">Generate a clean printable summary of your earnings — designed to share with a landlord or bank.</p>
      </div>

      <Card>
        <div className="grid md:grid-cols-4 gap-4">
          <Field label="From">
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Include">
            <select className="input" value={verifiedOnly ? "verified" : "all"} onChange={(e) => setVerifiedOnly(e.target.value === "verified")}>
              <option value="all">All shifts</option>
              <option value="verified">Only verified</option>
            </select>
          </Field>
          <div className="flex items-end">
            <a href={url} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">Open certificate</a>
          </div>
        </div>
        <Banner tone="info"><div className="mt-4">The certificate page has a <strong>Print / Save as PDF</strong> button. It embeds a tamper-evident stamp a landlord or bank can verify at <Link className="underline font-medium" target="_blank" to="/verify">/verify</Link> (share the URL — no account required).</div></Banner>
      </Card>

      <Card title="Preview URL">
        <code className="text-xs break-all text-slate-600">{url}</code>
      </Card>
    </div>
  );
}
