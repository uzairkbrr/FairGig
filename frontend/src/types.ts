export type Role = "worker" | "verifier" | "advocate";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  city?: string | null;
  category?: string | null;
}

export interface Shift {
  id: number;
  worker_id: number;
  platform: string;
  shift_date: string;
  hours: number;
  gross: number;
  deductions: number;
  net: number;
  category: string | null;
  city: string | null;
  note: string | null;
  screenshot_path: string | null;
  verification_status: "pending" | "verified" | "flagged" | "unverifiable";
  verified_by: number | null;
  verified_at: string | null;
  verifier_note: string | null;
  created_at: string;
}

export interface Complaint {
  id: number;
  worker_id: number;
  platform: string;
  category: string;
  description: string;
  status: "open" | "acknowledged" | "escalated" | "resolved" | "dismissed";
  cluster_id: number | null;
  moderated: number;
  tags: string[];
  created_at: string;
}

export interface Anomaly {
  shift_index: number | null;
  shift_date: string | null;
  platform: string | null;
  kind: "commission_spike" | "income_drop" | "hourly_outlier";
  severity: "low" | "medium" | "high";
  observed: number;
  baseline: number;
  z_score: number | null;
  message: string;
}

export interface WorkerSummary {
  worker_id: number;
  total: {
    gross: number; deductions: number; net: number;
    hours: number; shifts: number; verified_net: number;
    effective_hourly_rate: number;
  };
  weekly: Array<{
    week: string;
    gross: number; deductions: number; net: number;
    hours: number; shifts: number; effective_hourly_rate: number;
  }>;
  platforms: Array<{
    platform: string; gross: number; deductions: number; net: number;
    hours: number; shifts: number;
    commission_rate: number; effective_hourly_rate: number;
  }>;
  shift_count: number;
}
