import type { Complaint, Shift, User, WorkerSummary, Anomaly } from "./types";

const E = import.meta.env;
export const API = {
  AUTH:        E.VITE_AUTH_URL        || "http://localhost:4001",
  EARNINGS:    E.VITE_EARNINGS_URL    || "http://localhost:4002",
  ANOMALY:     E.VITE_ANOMALY_URL     || "http://localhost:4003",
  GRIEVANCE:   E.VITE_GRIEVANCE_URL   || "http://localhost:4004",
  ANALYTICS:   E.VITE_ANALYTICS_URL   || "http://localhost:4005",
  CERTIFICATE: E.VITE_CERTIFICATE_URL || "http://localhost:4006",
};

function token(): string | null {
  return localStorage.getItem("fg_access");
}

function authHeaders(): Record<string, string> {
  const t = token();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req<T>(
  base: string, path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...authHeaders(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const r = await fetch(`${base}${path}`, { ...init, headers });
  if (!r.ok) {
    let body: unknown = null;
    try { body = await r.json(); } catch { body = await r.text(); }
    const msg =
      (body as { error?: string; detail?: string })?.error ??
      (body as { detail?: string })?.detail ??
      String(body) ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  if (r.status === 204) return undefined as unknown as T;
  return r.json() as Promise<T>;
}

// -------- auth --------
export const auth = {
  login: (email: string, password: string) =>
    req<{ access_token: string; refresh_token: string; user: User }>(
      API.AUTH, "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),
  register: (p: { email: string; password: string; name: string; role: string; city?: string; category?: string }) =>
    req<{ access_token: string; refresh_token: string; user: User }>(
      API.AUTH, "/auth/register", { method: "POST", body: JSON.stringify(p) },
    ),
  me: () => req<User>(API.AUTH, "/auth/me"),
  user: (id: number) => req<User>(API.AUTH, `/auth/users/${id}`),
  listUsers: (role?: string) =>
    req<User[]>(API.AUTH, `/auth/users${role ? `?role=${role}` : ""}`),
};

// -------- earnings --------
export const earnings = {
  listMine: () => req<Shift[]>(API.EARNINGS, "/shifts"),
  listWorker: (workerId: number) =>
    req<Shift[]>(API.EARNINGS, `/shifts?worker_id=${workerId}`),
  listPending: () => req<Shift[]>(API.EARNINGS, "/shifts/pending-verification"),
  listAll: () => req<Shift[]>(API.EARNINGS, "/shifts"),
  create: (body: Partial<Shift>) =>
    req<Shift>(API.EARNINGS, "/shifts", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Shift>) =>
    req<Shift>(API.EARNINGS, `/shifts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) =>
    req<void>(API.EARNINGS, `/shifts/${id}`, { method: "DELETE" }),
  verify: (id: number, action: string, note?: string) =>
    req<Shift>(API.EARNINGS, `/shifts/${id}/verify`, {
      method: "POST", body: JSON.stringify({ action, note }),
    }),
  summary: (id: number) =>
    req<WorkerSummary>(API.EARNINGS, `/workers/${id}/summary`),
  platforms: () => req<string[]>(API.EARNINGS, "/platforms"),
  uploadScreenshot: async (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API.EARNINGS}/shifts/${id}/screenshot`, {
      method: "POST", body: fd, headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  importCsv: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch(`${API.EARNINGS}/shifts/import`, {
      method: "POST", body: fd, headers: authHeaders(),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{ created: number; errors: unknown[]; rows: { id: number; row: number }[] }>;
  },
  screenshotUrl: (name: string) => `${API.EARNINGS}/screenshots/${name}`,
};

// -------- anomaly --------
export const anomaly = {
  detectFromEarnings: (workerId: number) =>
    req<{ worker_id: number; input_shifts: number; anomalies: Anomaly[]; weekly_drops: Anomaly[]; summary: string }>(
      API.ANOMALY, `/detect/from-earnings/${workerId}`, { method: "POST" },
    ),
  detectRaw: (body: unknown) =>
    req<{ worker_id: number; input_shifts: number; anomalies: Anomaly[]; weekly_drops: Anomaly[]; summary: string }>(
      API.ANOMALY, `/detect`, { method: "POST", body: JSON.stringify(body) },
    ),
};

// -------- grievance --------
export const grievance = {
  list: (qs: Record<string, string | number> = {}) => {
    const q = new URLSearchParams();
    Object.entries(qs).forEach(([k, v]) => q.append(k, String(v)));
    return req<Complaint[]>(API.GRIEVANCE, `/complaints?${q.toString()}`);
  },
  bulletin: () => req<Complaint[]>(API.GRIEVANCE, "/bulletin?limit=50"),
  create: (body: { platform: string; category: string; description: string }) =>
    req<Complaint>(API.GRIEVANCE, "/complaints", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<Complaint>) =>
    req<Complaint>(API.GRIEVANCE, `/complaints/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) =>
    req<void>(API.GRIEVANCE, `/complaints/${id}`, { method: "DELETE" }),
  addTags: (id: number, tags: string[]) =>
    req<Complaint>(API.GRIEVANCE, `/complaints/${id}/tags`, { method: "POST", body: JSON.stringify({ tags }) }),
  removeTag: (id: number, tag: string) =>
    req<Complaint>(API.GRIEVANCE, `/complaints/${id}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" }),
  moderate: (id: number, moderated: boolean) =>
    req<Complaint>(API.GRIEVANCE, `/complaints/${id}/moderate`, { method: "POST", body: JSON.stringify({ moderated }) }),
  escalate: (id: number) =>
    req<Complaint>(API.GRIEVANCE, `/complaints/${id}/escalate`, { method: "POST" }),
  resolve: (id: number, note?: string) =>
    req<Complaint>(API.GRIEVANCE, `/complaints/${id}/resolve`, { method: "POST", body: JSON.stringify({ note }) }),
  clusters: () => req<Array<{ id: number; label: string; note?: string; member_count: number; samples: unknown[] }>>(API.GRIEVANCE, "/clusters"),
  autoCluster: () =>
    req<{ created: number; assigned: number }>(API.GRIEVANCE, "/clusters/auto", { method: "POST" }),
  tags: () => req<Array<{ tag: string; n: number }>>(API.GRIEVANCE, "/tags"),
};

// -------- analytics --------
export const analytics = {
  overview: () => req<any>(API.ANALYTICS, "/analytics/overview"),
  commissionTrends: (weeks = 12) =>
    req<any>(API.ANALYTICS, `/analytics/commission-trends?weeks=${weeks}`),
  incomeDistribution: (city?: string) =>
    req<any>(API.ANALYTICS, `/analytics/income-distribution${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  vulnerable: () => req<any>(API.ANALYTICS, "/analytics/vulnerable-workers"),
  topComplaints: (days = 7) =>
    req<any>(API.ANALYTICS, `/analytics/top-complaints?days=${days}`),
  cityMedian: (city: string, category?: string) =>
    req<any>(API.ANALYTICS, `/analytics/city-median?city=${encodeURIComponent(city)}${category ? `&category=${encodeURIComponent(category)}` : ""}`),
};

// -------- certificate --------
export const certificate = {
  url: (workerId: number, from: string, to: string, verifiedOnly = false) =>
    `${API.CERTIFICATE}/certificate?worker_id=${workerId}&from=${from}&to=${to}${verifiedOnly ? "&verified_only=true" : ""}`,
  verify: (stamp: string) =>
    req<{
      valid: boolean;
      error?: string;
      payload?: {
        worker_id: number;
        worker_name: string;
        range: { from: string; to: string };
        totals: { gross: number; deductions: number; net: number; hours: number; shifts: number; verified_net: number };
        generated_at: string;
      };
    }>(API.CERTIFICATE, "/verify", { method: "POST", body: JSON.stringify({ stamp }) }),
};
