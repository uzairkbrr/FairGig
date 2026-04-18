/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_URL?: string;
  readonly VITE_EARNINGS_URL?: string;
  readonly VITE_ANOMALY_URL?: string;
  readonly VITE_GRIEVANCE_URL?: string;
  readonly VITE_ANALYTICS_URL?: string;
  readonly VITE_CERTIFICATE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
