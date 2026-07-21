// Mock data for the fraud detection demo. Backend integration will replace this.

export type TxStatus =
  | "legitimate"
  | "otp_pending"
  | "otp_verified"
  | "confirmed_fraud";

export interface Terminal {
  id: string;
  lat: number;
  lng: number;
  city: string;
  fraudRate: number; // 0..1
  txCount: number;
}

export interface Transaction {
  id: string;
  time: string; // ISO
  customerId: string;
  terminalId: string;
  amount: number;
  fraudProbability: number;
  status: TxStatus;
}

export interface Alert {
  id: string;
  type: "high_risk_terminal" | "unusual_spending" | "high_prob" | "rapid_tx" | "otp_failed" | "hotspot";
  message: string;
  time: string;
  severity: "info" | "warning" | "danger";
}

// Seeded pseudo-random for determinism
function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seedRand(42);

// ~100 terminals scattered around a fictional metro area
export const terminals: Terminal[] = Array.from({ length: 100 }).map((_, i) => {
  const r = rand();
  const cities = ["Downtown", "Riverside", "Northgate", "Old Port", "Eastwood", "Midtown", "Sunset", "Harbor"];
  return {
    id: `TRM-${(1000 + i).toString()}`,
    // Coordinates mapped to a 100x100 canvas grid for the interactive picker
    lat: 10 + rand() * 80,
    lng: 8 + rand() * 84,
    city: cities[Math.floor(r * cities.length)],
    fraudRate: Math.max(0, Math.min(0.35, rand() * 0.28 - 0.02)),
    txCount: 200 + Math.floor(rand() * 4800),
  };
});

const statuses: TxStatus[] = ["legitimate", "legitimate", "legitimate", "legitimate", "otp_pending", "otp_verified", "confirmed_fraud"];

export const liveTransactions: Transaction[] = Array.from({ length: 40 }).map((_, i) => {
  const t = terminals[Math.floor(rand() * terminals.length)];
  const prob = rand();
  const status = prob > 0.85 ? statuses[6] : prob > 0.7 ? statuses[4] : prob > 0.6 ? statuses[5] : statuses[0];
  return {
    id: `TX-${100000 + i}`,
    time: new Date(Date.now() - i * 47_000).toISOString(),
    customerId: `${10000000 + Math.floor(rand() * 900)}`,
    terminalId: t.id,
    amount: Math.round(rand() * 1200 * 100) / 100,
    fraudProbability: Math.round(prob * 100) / 100,
    status,
  };
});

export const alerts: Alert[] = [
  { id: "a1", type: "high_prob", severity: "danger", message: "Transaction TX-100004 flagged with 94% fraud probability", time: "2m ago" },
  { id: "a2", type: "high_risk_terminal", severity: "warning", message: "Terminal TRM-1043 fraud rate spiked to 22%", time: "6m ago" },
  { id: "a3", type: "rapid_tx", severity: "warning", message: "Customer 10000451 issued 6 transactions in 90s", time: "12m ago" },
  { id: "a4", type: "otp_failed", severity: "danger", message: "OTP verification failed for TX-100011", time: "18m ago" },
  { id: "a5", type: "hotspot", severity: "info", message: "New fraud hotspot forming near Old Port", time: "34m ago" },
  { id: "a6", type: "unusual_spending", severity: "warning", message: "Customer 10000123 spent 4x typical amount", time: "41m ago" },
];

export const volumeSeries = Array.from({ length: 24 }).map((_, i) => ({
  hour: `${i}:00`,
  volume: Math.round(400 + Math.sin(i / 3) * 200 + rand() * 300),
  fraud: Math.round(4 + Math.abs(Math.sin(i / 4)) * 12 + rand() * 6),
}));

export const weekdaySeries = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
  day: d,
  fraud: Math.round(10 + rand() * 60),
  legit: Math.round(400 + rand() * 400),
}));

export const probHistogram = Array.from({ length: 10 }).map((_, i) => ({
  bin: `${i * 10}-${i * 10 + 10}%`,
  count: Math.round(300 * Math.exp(-Math.pow((i - 1) / 3, 2)) + rand() * 40),
}));

export const kpis = {
  totalTx: 128_450,
  fraudTx: 1_847,
  fraudRate: 1.44,
  activeCustomers: 24_120,
  activeTerminals: 100,
  newCustomers: 312,
  volume: 8_942_310,
  avgAmount: 69.6,
};

export function statusMeta(s: TxStatus) {
  switch (s) {
    case "legitimate": return { label: "Legitimate", color: "text-[color:var(--success)]", dot: "bg-[color:var(--success)]" };
    case "otp_pending": return { label: "OTP Pending", color: "text-[color:var(--warning)]", dot: "bg-[color:var(--warning)]" };
    case "otp_verified": return { label: "OTP Verified", color: "text-[color:var(--cyan)]", dot: "bg-[color:var(--cyan)]" };
    case "confirmed_fraud": return { label: "Confirmed Fraud", color: "text-[color:var(--danger)]", dot: "bg-[color:var(--danger)]" };
  }
}
