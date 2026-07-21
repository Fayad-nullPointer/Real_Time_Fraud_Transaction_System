import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck, CreditCard, MapPin, Phone, Mail, Calendar, LogOut,
  Copy, Edit3, Save, X, TrendingUp, AlertTriangle, CheckCircle2,
  Lock, Bell, Smartphone, Globe, ChevronLeft, Activity, DollarSign, Cpu, Sparkles,
} from "lucide-react";
import {
  txApi, authApi, getCustomer, clearCustomerToken, clearCustomer,
  type TxHistoryItem, type CustomerMlState,
} from "@/lib/api";
import { FeatureProfileViewer } from "@/components/FeatureProfileViewer";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Customer Profile — Sentinel" },
      { name: "description", content: "Manage your Sentinel customer profile, security settings, ML behavioral features and recent transaction activity." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type Profile = {
  cardNumber: string;
  phone: string;
  email: string;
  fullName: string;
  city: string;
  country: string;
  coords: { lat: number; lng: number } | null;
  createdAt: string;
  tier: "Standard" | "Gold" | "Platinum";
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
};

const DEFAULT_PROFILE: Profile = {
  cardNumber: "—",
  phone: "—",
  email: "customer@sentinel.app",
  fullName: "Customer",
  city: "—",
  country: "—",
  coords: null,
  createdAt: new Date().toISOString(),
  tier: "Standard",
  notifyEmail: true,
  notifySms: true,
  notifyPush: false,
};

function buildProfileFromCustomer(): Profile {
  const isBrowser = typeof window !== "undefined";
  const customer = getCustomer();
  const base: Profile = { ...DEFAULT_PROFILE };

  if (customer) {
    base.cardNumber = String(customer.customer_id ?? "—");
    base.phone = customer.phone_number ?? "—";
    base.fullName = customer.full_name || base.fullName;
  } else if (isBrowser) {
    base.cardNumber = localStorage.getItem("sentinel:cardNumber") ?? "—";
  }

  if (isBrowser) {
    try {
      const raw = localStorage.getItem("sentinel:profile");
      if (raw) return { ...base, ...JSON.parse(raw) };
    } catch {}
  }
  return base;
}

function getStatusDisplay(status: string): { label: string; color: string; dot: string } {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    APPROVED:    { label: "Legitimate",   color: "text-[color:var(--success)]", dot: "bg-[color:var(--success)]" },
    VERIFIED:    { label: "OTP Verified", color: "text-[color:var(--cyan)]",    dot: "bg-[color:var(--cyan)]" },
    PENDING_OTP: { label: "OTP Pending",  color: "text-[color:var(--warning)]", dot: "bg-[color:var(--warning)]" },
    DECLINED:    { label: "Fraud Blocked",color: "text-[color:var(--danger)]",  dot: "bg-[color:var(--danger)]" },
  };
  return map[status] ?? { label: status, color: "text-muted-foreground", dot: "bg-white/30" };
}

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [draft, setDraft] = useState<Profile>(DEFAULT_PROFILE);
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);
  const [mlState, setMlState] = useState<CustomerMlState | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "ml_profile">("overview");

  useEffect(() => {
    const p = buildProfileFromCustomer();
    setProfile(p);
    setDraft(p);
    setMounted(true);

    // Fetch full transaction history (limit 200)
    txApi.history(200)
      .then((h) => setTxHistory(h))
      .catch(() => {});

    // Fetch live ML feature state & cold-start status
    authApi.myState()
      .then((state) => {
        setMlState(state);
      })
      .catch(() => {});

    // Fetch me for real city/location
    authApi.me()
      .then((me) => {
        if (me.location) {
          const parts = me.location.split(",");
          setProfile((prev) => ({
            ...prev,
            city: parts[0]?.trim() || prev.city,
            country: parts[parts.length - 1]?.trim() || prev.country,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const recent = txHistory.slice(0, 8);

  const stats = useMemo(() => {
    const total = mlState?.db_stats?.total_txns ?? txHistory.length;
    const approvedTxns = txHistory.filter((t) => t.status === "APPROVED" || t.status === "VERIFIED");
    const spend = mlState?.db_stats?.total_spend ?? approvedTxns.reduce((a, b) => a + b.tx_amount, 0);
    const flagged = mlState?.db_stats?.fraud_count ?? txHistory.filter((t) => t.is_fraud || t.status === "DECLINED" || t.fraud_probability > 0.55).length;
    const verified = txHistory.filter((t) => t.status === "VERIFIED").length;
    
    // Real model risk score (0-100) based on average fraud probability
    const avgProb = mlState?.db_stats?.avg_prob ?? (total > 0 ? txHistory.reduce((a, b) => a + (b.fraud_probability ?? 0), 0) / total : 0);
    const risk = Math.min(100, Math.round(avgProb * 100));

    return { total, flagged, verified, spend: Math.round(spend), risk };
  }, [txHistory, mlState]);

  const save = () => {
    setProfile(draft);
    try { localStorage.setItem("sentinel:profile", JSON.stringify(draft)); } catch {}
    setEditing(false);
    toast.success("Profile updated");
  };

  const cancel = () => { setDraft(profile); setEditing(false); };

  const logout = () => {
    clearCustomerToken();
    try {
      localStorage.removeItem("sentinel:cardNumber");
      localStorage.removeItem("sentinel:profile");
    } catch {}
    toast.success("Signed out successfully");
    navigate({ to: "/login" });
  };

  const copyCard = () => {
    navigator.clipboard.writeText(profile.cardNumber);
    toast.success("Card number copied");
  };

  const initials = (profile.fullName || "C")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  if (!mounted) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[color:var(--background)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold">Sentinel</span>
            <span className="ml-1 text-xs text-muted-foreground">Customer Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/pay" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
              <ChevronLeft className="h-3.5 w-3.5" /> Back to portal
            </Link>
            <button
              type="button"
              onClick={logout}
              className="relative z-50 cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header Title */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customer Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your identity, view real risk statistics, and inspect ML behavioral features.</p>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${activeTab === "overview" ? "bg-[image:var(--gradient-primary)] text-white shadow-md" : "text-muted-foreground hover:text-white"}`}
            >
              <Activity className="h-3.5 w-3.5" /> Overview &amp; Activity
            </button>
            <button
              onClick={() => setActiveTab("ml_profile")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${activeTab === "ml_profile" ? "bg-[image:var(--gradient-primary)] text-white shadow-md" : "text-muted-foreground hover:text-white"}`}
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-300" /> ML Feature Profile Debugger
            </button>
          </div>
        </motion.div>

        {/* Real KPI Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total Transactions" value={stats.total.toLocaleString()} sub={`${stats.verified} OTP verified`} icon={<Activity className="h-4 w-4" />} />
          <StatCard label="Total Spend" value={`$${stats.spend.toLocaleString()}`} sub="Lifetime volume" icon={<DollarSign className="h-4 w-4" />} />
          <StatCard label="Flagged Incidents" value={stats.flagged.toString()} sub="High risk events" tone={stats.flagged > 0 ? "warning" : "default"} icon={<AlertTriangle className="h-4 w-4" />} />
          <StatCard label="Real Risk Score" value={`${stats.risk}/100`} sub={stats.risk < 25 ? "Safe Baseline" : "Elevated Risk"} tone={stats.risk < 25 ? "success" : "danger"} icon={<ShieldCheck className="h-4 w-4" />} />
        </div>

        {/* Tab 1: Overview & Activity */}
        {activeTab === "overview" && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Identity card */}
            <section className="glass-strong rounded-2xl p-6 lg:col-span-1">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-lg font-semibold text-white shadow-[var(--shadow-glow)]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-medium">{profile.fullName}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
                      <ShieldCheck className="h-3 w-3 text-[color:var(--success)]" /> Verified
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">{profile.tier}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="text-xs text-muted-foreground">Card Number (Customer ID)</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="font-mono text-xl tracking-wider gradient-text">{profile.cardNumber}</div>
                  <button onClick={copyCard} className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-3 text-xs">
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground">{profile.phone}</span>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground">{profile.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground">{profile.city}, {profile.country}</span>
                </div>
              </div>
            </section>

            {/* Main content: Transactions & Details */}
            <section className="space-y-6 lg:col-span-2">
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-medium">Transaction Activity History</h2>
                    <p className="text-xs text-muted-foreground">All recent payments associated with your card.</p>
                  </div>
                  <Link to="/pay" className="text-xs text-[color:var(--cyan)] hover:underline">
                    New transaction &rarr;
                  </Link>
                </div>

                {recent.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-muted-foreground">
                    No recent transaction activity recorded.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/10 text-muted-foreground">
                        <tr>
                          <th className="py-2 px-3 font-medium">Tx ID</th>
                          <th className="py-2 px-3 font-medium">Terminal</th>
                          <th className="py-2 px-3 font-medium">Date</th>
                          <th className="py-2 px-3 font-medium">Amount</th>
                          <th className="py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {recent.map((tx) => {
                          const statusInfo = getStatusDisplay(tx.status);
                          return (
                            <tr key={tx.transaction_id} className="hover:bg-white/[0.02] transition">
                              <td className="py-2.5 px-3 font-mono text-muted-foreground">{tx.transaction_id.slice(0, 10)}…</td>
                              <td className="py-2.5 px-3 font-medium">TRM-{tx.terminal_id}</td>
                              <td className="py-2.5 px-3 text-muted-foreground">{new Date(tx.tx_datetime).toLocaleString()}</td>
                              <td className="py-2.5 px-3 font-semibold text-foreground">${tx.tx_amount.toFixed(2)}</td>
                              <td className="py-2.5 px-3">
                                <span className={`inline-flex items-center gap-1.5 font-medium ${statusInfo.color}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                                  {statusInfo.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: ML Behavioral Feature Profile & Debugger */}
        {activeTab === "ml_profile" && (
          <div className="mt-6">
            <FeatureProfileViewer mlState={mlState} />
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub, tone, icon }: { label: string; value: string; sub: string; tone?: "success" | "warning" | "danger" | "default"; icon: React.ReactNode }) {
  const toneMap = {
    success: "text-[color:var(--success)]",
    warning: "text-amber-400",
    danger: "text-[color:var(--danger)]",
    default: "text-foreground",
  };
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`mt-2 font-mono text-xl font-semibold ${toneMap[tone ?? "default"]}`}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}
