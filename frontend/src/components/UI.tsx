import React, { ReactNode } from "react";

export function Card({ title, action, children, className = "" }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "warn" | "ok" | "bad";
}) {
  const toneCls = {
    default: "text-slate-900",
    ok:      "text-green-600",
    warn:    "text-amber-600",
    bad:     "text-red-600",
  }[tone];
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${toneCls}`}>{value}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}

export function Banner({ tone = "info", children }: {
  tone?: "info" | "warn" | "bad" | "ok"; children: ReactNode;
}) {
  const cls = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warn: "bg-amber-50 border-amber-200 text-amber-900",
    bad:  "bg-red-50 border-red-200 text-red-900",
    ok:   "bg-green-50 border-green-200 text-green-900",
  }[tone];
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>
  );
}

export function EmptyState({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-white">
      <div className="text-slate-600 font-medium">{title}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function fmtRs(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return "Rs. " + Math.round(n).toLocaleString("en-PK");
}

export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "pill-pending",
    verified: "pill-verified",
    flagged: "pill-flagged",
    unverifiable: "pill-unverifiable",
    open: "pill-open",
    escalated: "pill-escalated",
    resolved: "pill-resolved",
    acknowledged: "pill-pending",
    dismissed: "pill-unverifiable",
  };
  return <span className={cls[status] ?? "pill bg-slate-200 text-slate-800"}>{status}</span>;
}

export function SeverityPill({ severity }: { severity: string }) {
  const cls: Record<string, string> = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-sky-100 text-sky-800",
  };
  return <span className={`pill ${cls[severity] ?? ""}`}>{severity}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-slate-700 mb-1">{label}</div>
      {children}
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </label>
  );
}
