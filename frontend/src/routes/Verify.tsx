import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { certificate } from "../api";
import { Banner, Card, Field, fmtRs } from "../components/UI";

type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "valid"; payload: NonNullable<Awaited<ReturnType<typeof certificate.verify>>["payload"]> }
  | { kind: "invalid"; reason: string };

export default function Verify() {
  const [stamp, setStamp] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = stamp.trim();
    if (!clean) return;
    setResult({ kind: "loading" });
    try {
      const r = await certificate.verify(clean);
      if (r.valid && r.payload) {
        setResult({ kind: "valid", payload: r.payload });
      } else {
        setResult({ kind: "invalid", reason: r.error || "signature does not match" });
      }
    } catch (e: any) {
      setResult({ kind: "invalid", reason: e.message || "verification failed" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold">F</div>
          <div className="font-bold tracking-tight">Fair<span className="text-brand-500">Gig</span></div>
          <Link to="/login" className="ml-auto text-sm text-slate-500 hover:underline">Sign in →</Link>
        </div>

        <Card title="Verify an income certificate">
          <p className="text-sm text-slate-600 mb-4">
            Paste the <strong>verification stamp</strong> printed at the bottom of a FairGig income
            certificate. The stamp is an HMAC-signed payload that proves the document
            was rendered by this service and that its totals and date range have not
            been altered.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Stamp" hint="Looks like: eyJ3b3JrZXJfaWQiOjEs…. A1b2c3…">
              <textarea
                className="input font-mono text-[12px] leading-relaxed"
                rows={5}
                value={stamp}
                onChange={(e) => setStamp(e.target.value)}
                placeholder="paste the stamp here"
                required
              />
            </Field>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={result.kind === "loading"}>
                {result.kind === "loading" ? "Verifying…" : "Verify"}
              </button>
              {stamp && (
                <button type="button" className="btn-ghost"
                        onClick={() => { setStamp(""); setResult({ kind: "idle" }); }}>
                  Clear
                </button>
              )}
            </div>
          </form>
        </Card>

        {result.kind === "invalid" && (
          <Banner tone="bad">
            <strong>Invalid stamp.</strong> {result.reason}. This document was not
            rendered by FairGig, or its totals have been tampered with after rendering.
          </Banner>
        )}

        {result.kind === "valid" && (
          <Card title="Stamp verified">
            <Banner tone="ok">
              <strong>Signature valid.</strong> The certificate below was rendered by the FairGig service and its contents are unchanged.
            </Banner>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <Row label="Worker" value={result.payload.worker_name} />
              <Row label="Worker ID" value={`#${result.payload.worker_id}`} />
              <Row label="Covers" value={`${result.payload.range.from} → ${result.payload.range.to}`} />
              <Row label="Rendered" value={result.payload.generated_at} />
              <Row label="Shifts in period" value={String(result.payload.totals.shifts)} />
              <Row label="Hours worked" value={result.payload.totals.hours.toFixed(1)} />
              <Row label="Gross earnings" value={fmtRs(result.payload.totals.gross)} />
              <Row label="Platform deductions" value={fmtRs(result.payload.totals.deductions)} />
              <Row label="Net earnings" value={fmtRs(result.payload.totals.net)} strong />
              <Row label="Verified net" value={fmtRs(result.payload.totals.verified_net)} strong />
            </dl>
          </Card>
        )}

        <div className="text-xs text-slate-500 text-center">
          This page uses <code>POST /verify</code> on the FairGig certificate service. The stamp is signed with HMAC-SHA256; tampered documents fail verification.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-1 ${strong ? "font-bold text-lg" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
