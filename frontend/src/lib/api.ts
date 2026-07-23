const getApiBase = (): string => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8005`;
  }
  return "http://backend:8000";
};

// ---------------------------------------------------------------------------
// Token / session helpers  (localStorage is client-only; guard for SSR)
// Dual-token isolation so Customer Portal and Admin Dashboard run in separate tabs independently
// ---------------------------------------------------------------------------
// Global OTP Timeout (in seconds) — shared across backend and frontend
export const OTP_TTL_SECONDS = 40;

const isBrowser = typeof window !== "undefined";

export const getAdminToken = (): string | null =>
  isBrowser ? localStorage.getItem("sentinel:admin_token") || localStorage.getItem("sentinel:token") : null;

export const setAdminToken = (t: string) => {
  if (isBrowser) {
    localStorage.setItem("sentinel:admin_token", t);
    localStorage.setItem("sentinel:token", t);
  }
};

export const clearAdminToken = () => {
  if (isBrowser) {
    localStorage.removeItem("sentinel:admin_token");
  }
};

export const getCustomerToken = (): string | null =>
  isBrowser ? localStorage.getItem("sentinel:customer_token") || localStorage.getItem("sentinel:token") : null;

export const setCustomerToken = (t: string) => {
  if (isBrowser) {
    localStorage.setItem("sentinel:customer_token", t);
    localStorage.setItem("sentinel:token", t);
  }
};

export const clearCustomerToken = () => {
  if (isBrowser) {
    localStorage.removeItem("sentinel:customer_token");
    localStorage.removeItem("sentinel:customer");
  }
};

export const getToken = (): string | null => getCustomerToken() || getAdminToken();
export const setToken = (t: string) => { setCustomerToken(t); setAdminToken(t); };
export const clearToken = () => { clearCustomerToken(); clearAdminToken(); };
export const getCustomer = () => isBrowser ? JSON.parse(localStorage.getItem("sentinel:customer") ?? "null") : null;
export const setCustomer = (c: unknown) => { if (isBrowser) localStorage.setItem("sentinel:customer", JSON.stringify(c)); };
export const clearCustomer = () => { if (isBrowser) localStorage.removeItem("sentinel:customer"); };

// ---------------------------------------------------------------------------
// TypeScript interfaces
// ---------------------------------------------------------------------------
export interface TxHistoryItem {
  transaction_id: string;
  terminal_id: number;
  tx_amount: number;
  tx_datetime: string;
  is_fraud: boolean;
  fraud_probability: number;
  scenario_name: string | null;
  status: string;
}

export interface ApiTerminal {
  terminal_id: number;
  terminal_name: string;
  latitude: number;
  longitude: number;
}

export interface CustomerMe {
  customer_id: number;
  phone_number: string;
  full_name: string | null;
  role: string;
  registration_lat: number | null;
  registration_lon: number | null;
  location: string;
}

export interface CustomerMlState {
  customer_id: number;
  known_profile: boolean;
  is_cold_start: boolean;
  is_warm: boolean;
  spending_tier: string | null;
  profile?: {
    mean_amount?: number;
    std_amount?: number;
    mean_nb_tx_per_day?: number;
    nb_terminals?: number;
    [key: string]: unknown;
  } | null;
  realtime?: {
    last_amounts_chronological?: number[];
    tx_count_1h_approx?: number;
    tx_count_4h_approx?: number;
    cold_start_running_n?: number;
    cold_start_running_mean?: number;
    [key: string]: unknown;
  };
  db_stats?: {
    total_txns: number;
    total_spend: number;
    avg_prob: number;
    fraud_count: number;
  };
}

export interface DashMetrics {
  total_transactions: number;
  transaction_volume: number;
  fraud_detected: number;
  confirmed_fraud: number;
  legitimate: number;
  false_positives_corrected: number;
  fraud_rate: number;
  active_customers: number;
  active_terminals: number;
  registered_customers: number;
  registered_terminals: number;
  otp_funnel: {
    fraud_predictions: number;
    otp_sent: number;
    otp_verified: number;
    confirmed_fraud: number;
  };
  hourly: { hour: number; tx_count: number; total_amount: number; fraud_count: number }[];
  scenarios: { scenario_name: string; cnt: number }[];
  top_reasons: { top_reason: string; cnt: number }[];
}

export interface DashTx {
  transaction_id: string;
  customer_id: number;
  terminal_id: number;
  tx_amount: number;
  tx_datetime: string;
  is_fraud: boolean;
  fraud_probability: number;
  scenario_name: string | null;
  top_reason: string | null;
  status: string;
}

export interface DashTxDetail extends DashTx {
  scenario_id: number | null;
  shap_explanation: { feature: string; value: number; impact: number }[];
  llm_report: string | null;
}

export interface SystemHealth {
  fastapi: { status: string };
  postgres: { status: string };
  redis: { status: string; cache_hit_rate: number };
  ml_model: { status: string; version: string; inference_ms: number };
  websocket: { connected_clients: number };
  resources: { cpu: number; ram: number; disk: number };
}

export interface DashCustomer {
  customer_id: number;
  phone_number: string;
  full_name: string | null;
  location: string;
  lat: number | null;
  lon: number | null;
  total_txns: number;
  avg_amount: number;
  terminals_used: number;
  risk_score: number;
}

export interface DashCustomerProfile extends DashCustomer {
  mean_amount: number;
  std_amount: number;
  txns_per_day: number;
  recent_transactions: {
    transaction_id: string;
    tx_amount: number;
    days_ago: number | null;
    is_fraud: boolean;
    status: string;
    fraud_probability: number;
    scenario_name: string | null;
    top_reason: string | null;
  }[];
}

export interface AnalyticsCharts {
  volume_series: { hour: string; volume: number; fraud: number }[];
  weekday_series: { day: string; fraud: number; legit: number }[];
  prob_histogram: { bin: string; count: number }[];
  otp_outcomes: { name: string; value: number; color: string }[];
  model_dist: { name: string; value: number; color: string }[];
  top_scenarios: { scenario_name: string; cnt: number }[];
  hourly_fraud_rate: { hour: string; rate: number }[];
}

export interface DashTerminal {
  terminal_id: number;
  terminal_name: string;
  latitude: number;
  longitude: number;
  total_txns: number;
  fraud_count: number;
  fraud_rate_3d: number;
  fraud_rate_7d: number;
  fraud_rate_28d: number;
  nearby_incidents: number;
  risk_score: number;
}

export interface DashAlert {
  id: string;
  type: string;
  severity: "info" | "warning" | "danger";
  message: string;
  time: string;
}

export interface FraudMapPoint {
  transaction_id: string;
  customer_id: number;
  terminal_id: number;
  tx_amount: number;
  fraud_probability: number;
  scenario_name: string | null;
  status: string;
  tx_datetime: string;
  customer_lat: number | null;
  customer_lon: number | null;
  terminal_lat: number;
  terminal_lon: number;
  terminal_name: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  name: string;
  message: string;
  event_type?: string;
  transaction_id?: number;
  fraud_probability?: number;
  scenario?: string;
  top_reasons?: Record<string, number>;
  phone?: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Generic fetch wrapper
// ---------------------------------------------------------------------------
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const isDashboardPath = path.startsWith("/api/dashboard");
    const token = isDashboardPath ? (getAdminToken() || getCustomerToken()) : (getCustomerToken() || getAdminToken());
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { detail?: string }).detail ?? "Request failed");
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const authApi = {
  login: (customer_id: number, password: string) =>
    apiFetch<{
      token: string;
      customer_id: number;
      phone_number: string;
      full_name: string;
      role: string;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ customer_id, password }),
    }),

  register: (body: {
    phone_number: string;
    password: string;
    full_name?: string;
    lat?: number | null;
    lon?: number | null;
  }) =>
    apiFetch<{
      token: string;
      customer_id: number;
      phone_number: string;
      full_name: string;
      role: string;
    }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => apiFetch<CustomerMe>("/api/auth/me", {}, true),
  myState: () => apiFetch<CustomerMlState>("/api/auth/me/state", {}, true),
  updateLocation: (lat: number, lon: number) =>
    apiFetch<{ status: string; location: string }>("/api/auth/location", {
      method: "POST",
      body: JSON.stringify({ lat, lon }),
    }, true),
};

// ---------------------------------------------------------------------------
// Transactions API (customer-facing)
// ---------------------------------------------------------------------------
export const txApi = {
  create: (body: {
    terminal_id: number;
    tx_amount: number;
    lat?: number | null;
    lon?: number | null;
  }) =>
    apiFetch<{
      transaction_id: string;
      status: string;
      message: string;
      fraud_probability?: number;
      scenario?: string;
      top_reason?: string;
      top_reasons?: { feature: string; shap_value: number; type: string }[];
    }>("/api/transactions/create", { method: "POST", body: JSON.stringify(body) }, true),

  verify: (transaction_id: string, otp_code: string) =>
    apiFetch<{ status: string; message: string }>(
      "/api/transactions/verify",
      { method: "POST", body: JSON.stringify({ transaction_id, otp_code }) },
      true,
    ),

  decline: (transaction_id: string) =>
    apiFetch<{ status: string; message: string }>(
      "/api/transactions/decline",
      { method: "POST", body: JSON.stringify({ transaction_id, otp_code: "000000" }) },
      true,
    ),

  history: (limit = 20) =>
    apiFetch<TxHistoryItem[]>(`/api/transactions/history?limit=${limit}`, {}, true),
};

// ---------------------------------------------------------------------------
// Terminals API
// ---------------------------------------------------------------------------
export const terminalApi = {
  list: () => apiFetch<ApiTerminal[]>("/api/terminals", {}, false),
};

// ---------------------------------------------------------------------------
// Dashboard API (admin)
// ---------------------------------------------------------------------------
export const dashboardApi = {
  metrics: () => apiFetch<DashMetrics>("/api/dashboard/metrics", {}, true),

  transactions: (limit = 50, offset = 0) =>
    apiFetch<DashTx[]>(
      `/api/dashboard/transactions?limit=${limit}&offset=${offset}`,
      {},
      true,
    ),

  transactionDetail: (id: string) =>
    apiFetch<DashTxDetail>(`/api/dashboard/transactions/${id}`, {}, true),

  system: () => apiFetch<SystemHealth>("/api/dashboard/system", {}, true),

  customers: (limit = 200) =>
    apiFetch<DashCustomer[]>(`/api/dashboard/customers?limit=${limit}`, {}, true),

  customerProfile: (id: number) =>
    apiFetch<DashCustomerProfile>(`/api/dashboard/customers/${id}`, {}, true),

  analyticsCharts: () =>
    apiFetch<AnalyticsCharts>("/api/dashboard/analytics/charts", {}, true),

  terminalStats: () =>
    apiFetch<DashTerminal[]>("/api/dashboard/terminals/stats", {}, true),

  alerts: () => apiFetch<DashAlert[]>("/api/dashboard/alerts", {}, true),

  fraudMap: () => apiFetch<FraudMapPoint[]>("/api/dashboard/fraud-map", {}, true),

  logs: (limit = 200, level = "") =>
    apiFetch<LogEntry[]>(`/api/dashboard/logs?limit=${limit}&level=${level}`, {}, true),

  reports: () => apiFetch<DashReport[]>("/api/dashboard/reports", {}, true),

  generateReport: (transactionId: string) =>
    apiFetch<{ llm_report: string; cached: boolean }>(
      `/api/dashboard/transactions/${transactionId}/generate-report`,
      { method: "POST" },
      true,
    ),
};
