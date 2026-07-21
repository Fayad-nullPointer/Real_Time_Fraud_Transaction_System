import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, TrendingUp, Users, MapPin, UserPlus,
  DollarSign, ArrowUpRight, ArrowDownRight, ShieldAlert, HelpCircle,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { useEffect, useState } from "react";
import { dashboardApi, type DashMetrics, type DashTx } from "@/lib/api";
import { useAdminWs } from "@/hooks/useAdminWs";

export const Route = createFileRoute("/dashboard/")({
  component: OverviewPage,
});

// Static weekday fallback (API metrics endpoint has no weekday breakdown)
const WEEKDAY_FALLBACK = [
  { day: "Mon", fraud: 42 },
  { day: "Tue", fraud: 38 },
  { day: "Wed", fraud: 55 },
  { day: "Thu", fraud: 61 },
  { day: "Fri", fraud: 79 },
  { day: "Sat", fraud: 34 },
  { day: "Sun", fraud: 28 },
];

function OverviewPage() {
  const [metrics, setMetrics] = useState<DashMetrics | null>(null);
  const [recentTx, setRecentTx] = useState<DashTx[]>([]);
  const [alerts, setAlerts] = useState<{ id: string; severity: string; message: string; time: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [m, tx] = await Promise.all([
          dashboardApi.metrics(),
          dashboardApi.transactions(12),
        ]);
        setMetrics(m);
        setRecentTx(tx);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    })();

    (async () => {
      try {
        const a = await dashboardApi.alerts();
        setAlerts(a);
      } catch (_) {}
    })();
  }, []);

  const isConnected = useAdminWs((ev) => {
    if (ev.event === "TRANSACTION") {
      const newRow: DashTx = {
        transaction_id: ev.transaction_id,
        customer_id: ev.customer_id,
        terminal_id: ev.terminal_id,
        tx_amount: ev.amount,
        tx_datetime: ev.timestamp,
        is_fraud: ev.is_fraud,
        fraud_probability: ev.fraud_probability,
        scenario_name: ev.scenario_name,
        top_reason: null,
        status: ev.status,
      };
      setRecentTx((prev) => [newRow, ...prev].slice(0, 12));
    }
  });

  const volumeData =
    metrics?.hourly.map((h) => ({
      hour: `${h.hour}:00`,
      volume: h.tx_count,
      fraud: h.fraud_count,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Real-time snapshot of the payments network.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total transactions" value={metrics?.total_transactions?.toLocaleString() ?? "—"} delta="+3.4%" up icon={<Activity className="h-4 w-4" />} />
        <Kpi label="Fraudulent transactions" value={metrics?.fraud_detected?.toLocaleString() ?? "—"} delta="+4.2%" up tone="danger" icon={<AlertTriangle className="h-4 w-4" />} />
        <Kpi label="Fraud rate" value={metrics != null ? `${(metrics.fraud_rate * 100).toFixed(2)}%` : "—"} delta="-0.2%" up={false} tone="warning" icon={<ShieldAlert className="h-4 w-4" />} />
        <Kpi label="Active customers" value={metrics?.active_customers?.toLocaleString() ?? "—"} delta="+1.1%" up icon={<Users className="h-4 w-4" />} />
        <Kpi label="Active terminals" value={metrics?.active_terminals?.toString() ?? "—"} delta="0" up icon={<MapPin className="h-4 w-4" />} />
        <Kpi label="False positives corrected" value={metrics?.false_positives_corrected?.toLocaleString() ?? "—"} delta="+8.6%" up icon={<UserPlus className="h-4 w-4" />} />
        <Kpi label="Transaction volume" value={metrics != null ? (metrics.transaction_volume >= 1_000_000 ? `$${(metrics.transaction_volume / 1_000_000).toFixed(2)}M` : metrics.transaction_volume >= 1_000 ? `$${(metrics.transaction_volume / 1_000).toFixed(2)}K` : `$${metrics.transaction_volume.toFixed(2)}`) : "—"} delta="+2.7%" up icon={<TrendingUp className="h-4 w-4" />} />
        <Kpi label="Confirmed fraud" value={metrics?.confirmed_fraud?.toLocaleString() ?? "—"} delta="-0.4%" up={false} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2 relative">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-sm font-medium text-white">Transaction volume · 24h</div>
                <div className="text-xs text-muted-foreground">Volume and fraud incidents by hour</div>
              </div>

              <div className="group relative inline-flex items-center">
                <button type="button" className="text-muted-foreground hover:text-cyan-400 focus:outline-none transition-colors">
                  <HelpCircle className="h-4 w-4" />
                </button>
                <div className="pointer-events-none absolute left-0 top-full mt-2 hidden w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50">
                  <div className="font-semibold text-cyan-300">Transaction Volume (24h)</div>
                  <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    Live operational stream showing total payment traffic (blue area) vs flagged fraud attempts (red area) for every hour in the last 24 hours.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs text-[color:var(--success)]">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "animate-pulse bg-[color:var(--success)]" : "bg-[color:var(--warning)]"}`} />
              {isConnected ? "Live" : "Connecting…"}
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={volumeData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gVol" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFraud" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="volume" stroke="#60A5FA" strokeWidth={2} fill="url(#gVol)" />
                <Area type="monotone" dataKey="fraud" stroke="#EF4444" strokeWidth={2} fill="url(#gFraud)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 relative">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Fraud by weekday</div>
              <div className="text-xs text-muted-foreground">Last 30 days</div>
            </div>

            <div className="group relative inline-flex items-center">
              <button type="button" className="text-muted-foreground hover:text-cyan-400 focus:outline-none transition-colors">
                <HelpCircle className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute right-0 top-full mt-2 hidden w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50">
                <div className="font-semibold text-cyan-300">Fraud by Weekday</div>
                <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Compares overall fraud attempts across each day of the week to see if fraud attacks spike on specific days (e.g. weekends).
                </div>
              </div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={WEEKDAY_FALLBACK} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBar" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="fraud" fill="url(#gBar)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LiveTable rows={recentTx} />
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, up, tone, icon }: { label: string; value: string; delta: string; up: boolean; tone?: "danger" | "warning"; icon: React.ReactNode }) {
  const tint = tone === "danger" ? "text-[color:var(--danger)]" : tone === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--cyan)]";
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4">
      <div className={`flex items-center gap-2 text-xs text-muted-foreground`}>
        <span className={tint}>{icon}</span> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold">{value}</div>
      <div className={`mt-0.5 inline-flex items-center gap-1 text-xs ${up ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {delta}
      </div>
    </motion.div>
  );
}

function statusMeta(status: string) {
  switch (status) {
    case "APPROVED": return { label: "Approved", color: "text-[color:var(--success)]", dot: "bg-[color:var(--success)]" };
    case "VERIFIED": return { label: "Verified", color: "text-[color:var(--cyan)]", dot: "bg-[color:var(--cyan)]" };
    case "PENDING_OTP": return { label: "OTP Pending", color: "text-[color:var(--warning)]", dot: "bg-[color:var(--warning)]" };
    case "DECLINED": return { label: "Declined", color: "text-[color:var(--danger)]", dot: "bg-[color:var(--danger)]" };
    default: return { label: status, color: "text-muted-foreground", dot: "bg-white/30" };
  }
}

function LiveTable({ rows }: { rows: DashTx[] }) {
  return (
    <div className="glass rounded-2xl p-5 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Live transactions</div>
          <div className="text-xs text-muted-foreground">Updated via WebSocket</div>
        </div>
        <div className="flex items-center gap-1 text-xs text-[color:var(--success)]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" /> Streaming
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="py-2 pr-3 font-medium">Time</th>
              <th className="py-2 pr-3 font-medium">Customer</th>
              <th className="py-2 pr-3 font-medium">Terminal</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Fraud prob.</th>
              <th className="py-2 pr-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = statusMeta(r.status);
              return (
                <tr key={r.transaction_id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5 pr-3 text-muted-foreground">{new Date(r.tx_datetime).toLocaleTimeString()}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.customer_id}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.terminal_id}</td>
                  <td className="py-2.5 pr-3">${r.tx_amount.toFixed(2)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full" style={{ width: `${r.fraud_probability * 100}%`, background: r.fraud_probability > 0.7 ? "var(--danger)" : r.fraud_probability > 0.4 ? "var(--warning)" : "var(--success)" }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{(r.fraud_probability * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 text-xs ${meta.color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: { id: string; severity: string; message: string; time: string }[] }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3">
        <div className="text-sm font-medium">Alerts</div>
        <div className="text-xs text-muted-foreground">Priority-ranked</div>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const tone = a.severity === "danger" ? "text-[color:var(--danger)]" : a.severity === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--cyan)]";
          const bg = a.severity === "danger" ? "bg-[color:var(--danger)]/10" : a.severity === "warning" ? "bg-[color:var(--warning)]/10" : "bg-[color:var(--cyan)]/10";
          return (
            <motion.li key={a.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} className={`flex items-start gap-3 rounded-xl border border-white/5 p-3 ${bg}`}>
              <AlertTriangle className={`mt-0.5 h-4 w-4 ${tone}`} />
              <div className="min-w-0">
                <div className="truncate text-sm">{a.message}</div>
                <div className="text-xs text-muted-foreground">{a.time}</div>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
