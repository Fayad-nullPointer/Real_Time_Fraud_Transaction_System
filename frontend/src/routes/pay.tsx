import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, MapPin, Search, CreditCard, DollarSign, ArrowRight,
  CheckCircle2, AlertTriangle, Loader2, KeyRound, LogOut, TrendingUp, History,
} from "lucide-react";
import { toast } from "sonner";
import {
  txApi, terminalApi, authApi, getCustomer, clearCustomerToken, clearCustomer,
  OTP_TTL_SECONDS, type ApiTerminal, type TxHistoryItem,
} from "@/lib/api";
import { GoogleTerminalMap } from "@/components/GoogleTerminalMap";

export const Route = createFileRoute("/pay")({
  component: PayPage,
});

type Phase = "form" | "predicting" | "result" | "otp" | "final";

interface Prediction {
  probability: number;
  label: "legit" | "fraud";
  confidence: number;
  contributions: { name: string; impact: "High" | "Medium" | "Low"; value: number; direction: 1 | -1 }[];
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "recently";
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", color: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30" };
    case "VERIFIED":
      return { label: "OTP Verified", color: "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)] border-[color:var(--cyan)]/30" };
    case "PENDING_OTP":
      return { label: "OTP Pending", color: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30" };
    case "DECLINED":
      return { label: "Fraud Blocked", color: "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border-[color:var(--danger)]/30" };
    default:
      return { label: status, color: "bg-white/10 text-muted-foreground border-white/10" };
  }
}

function mapShapContributions(
  topReasons?: { feature: string; shap_value: number; type: string }[],
  amt: number = 0,
  prob: number = 0.1
) {
  if (topReasons && topReasons.length > 0) {
    const labelMap: Record<string, string> = {
      TX_AMOUNT: "Transaction Amount",
      DIST_FROM_HOME: "Distance from home",
      TERMINAL_RISK: "Terminal Risk",
      NIGHT_TX: "Night Transaction",
      CUSTOMER_VELOCITY: "Customer velocity (24h)",
      OTP_NOT_ENTERED: "OTP Verification Required",
    };

    return topReasons.map((r) => {
      const val = Math.abs(r.shap_value);
      const impact: "High" | "Medium" | "Low" = val > 0.3 ? "High" : val > 0.1 ? "Medium" : "Low";
      const name = labelMap[r.feature] ?? r.feature.replace(/_/g, " ");
      return {
        name,
        impact,
        value: Math.min(1, Math.max(0.1, val)),
        direction: r.shap_value >= 0 ? (1 as const) : (-1 as const),
      };
    });
  }

  return [
    { name: "Transaction Amount", impact: amt > 500 ? ("High" as const) : ("Medium" as const), value: Math.min(1, Math.max(0.08, amt / 1500)), direction: 1 as const },
    { name: "Distance from home", impact: "Medium" as const, value: 0.15, direction: -1 as const },
    { name: "Terminal Risk", impact: "Low" as const, value: 0.08, direction: -1 as const },
    { name: "Night Transaction", impact: "Low" as const, value: 0.05, direction: -1 as const },
    { name: "Customer velocity (24h)", impact: "Low" as const, value: 0.12, direction: -1 as const },
  ];
}

function PayPage() {
  const navigate = useNavigate();
  const [apiTerminals, setApiTerminals] = useState<ApiTerminal[]>([]);
  const [selected, setSelected] = useState<ApiTerminal | null>(null);
  const [amount, setAmount] = useState("");
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [otp, setOtp] = useState("");
  const [otpOutcome, setOtpOutcome] = useState<"success" | "fail" | null>(null);
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [otpSeconds, setOtpSeconds] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dynamic profile and history states
  const [regLocation, setRegLocation] = useState<string>("Loading location...");
  const [recentTxns, setRecentTxns] = useState<TxHistoryItem[]>([]);

  const customer = getCustomer();
  const cardNumber = customer?.customer_id
    ? String(customer.customer_id)
    : (typeof window !== "undefined" ? localStorage.getItem("sentinel:cardNumber") ?? "—" : "—");

  // Fetch recent transactions history
  const refreshHistory = useCallback(() => {
    txApi.history(6)
      .then(setRecentTxns)
      .catch(() => {});
  }, []);

  // Fetch customer profile for registered location
  const refreshProfile = useCallback(() => {
    authApi.me()
      .then((me) => {
        setRegLocation(me.location || "Cairo, Egypt");
      })
      .catch(() => {
        setRegLocation("Cairo, Egypt");
      });
  }, []);

  // On mount: fetch terminals, profile, history and geolocation
  useEffect(() => {
    terminalApi.list().then((list) => {
      setApiTerminals(list);
      if (list.length > 0) setSelected(list[0]);
    }).catch(() => {});

    refreshProfile();
    refreshHistory();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const coords = { lat: p.coords.latitude, lon: p.coords.longitude };
          setUserLoc(coords);
          authApi.updateLocation(coords.lat, coords.lon)
            .then((res) => {
              if (res.location && res.location !== "Unknown") {
                setRegLocation(res.location);
              }
            })
            .catch(() => {});
        },
        () => {},
        { timeout: 8000 }
      );
    }
  }, [refreshProfile, refreshHistory]);

  const filtered = useMemo(() => {
    if (!query) return apiTerminals;
    const q = query.toLowerCase();
    return apiTerminals.filter(
      (t) =>
        String(t.terminal_id).toLowerCase().includes(q) ||
        t.terminal_name.toLowerCase().includes(q)
    );
  }, [query, apiTerminals]);

  // Compute last transaction string for Account Card
  const lastTxnText = useMemo(() => {
    if (recentTxns.length === 0) return "No transactions yet";
    const last = recentTxns[0];
    return `$${last.tx_amount.toFixed(2)} · ${formatRelativeTime(last.tx_datetime)}`;
  }, [recentTxns]);

  // OTP countdown effect
  useEffect(() => {
    if (phase === "otp") {
      countdownRef.current = setInterval(() => {
        setOtpSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (pendingTxId) {
              txApi.decline(pendingTxId).catch(() => {});
            }
            setOtpOutcome("fail");
            setPhase("final");
            refreshHistory();
            toast.error("OTP timed out. Transaction auto-declined.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [phase, pendingTxId, refreshHistory]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!selected) { toast.error("Select a terminal on the map"); return; }
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setPhase("predicting");
    try {
      const res = await txApi.create({
        terminal_id: selected.terminal_id,
        tx_amount: amt,
        lat: userLoc?.lat,
        lon: userLoc?.lon,
      });

      const prob = res.fraud_probability ?? 0.05;
      const label: "legit" | "fraud" = prob > 0.55 ? "fraud" : "legit";
      const confidence = label === "legit" ? Math.min(0.99, Math.max(0.72, 1 - prob)) : Math.min(0.99, Math.max(0.70, prob));
      const contributions = mapShapContributions(res.top_reasons, amt, prob);

      if (res.status === "PENDING_OTP") {
        setPendingTxId(res.transaction_id);
        setPrediction({
          probability: prob,
          label,
          confidence,
          contributions,
        });
        setOtp("");
        setOtpSeconds(res.otp_expires_in ?? OTP_TTL_SECONDS);
        refreshHistory();
        // Automatically pop up the OTP Modal Window!
        setPhase("otp");
      } else if (res.status === "APPROVED") {
        setPrediction({
          probability: prob,
          label: "legit",
          confidence,
          contributions,
        });
        setOtpOutcome("success");
        setPhase("final");
        refreshHistory();
        toast.success(res.message ?? "Transaction approved");
      } else {
        toast.error(res.message ?? "Transaction failed");
        setPhase("form");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transaction failed");
      setPhase("form");
    }
  };

  const startOtp = () => { setPhase("otp"); setOtp(""); setOtpOutcome(null); };

  const verifyOtp = async () => {
    if (otp.length < 4) { toast.error("Enter the verification code"); return; }
    if (!pendingTxId) return;
    try {
      const res = await txApi.verify(pendingTxId, otp);
      if (res.status === "VERIFIED") {
        setOtpOutcome("success");
        setPhase("final");
        refreshHistory();
        toast.success("OTP Verified — Transaction completed");
      } else {
        setOtpOutcome("fail");
        setPhase("final");
        refreshHistory();
        toast.error("OTP Failed — Transaction declined");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "OTP verification failed");
      setOtpOutcome("fail");
      setPhase("final");
      refreshHistory();
    }
  };

  const reset = () => {
    setPhase("form"); setPrediction(null); setAmount(""); setOtp(""); setOtpOutcome(null); setPendingTxId(null);
    refreshHistory();
  };

  const logout = () => {
    clearCustomerToken();
    try { localStorage.removeItem("sentinel:cardNumber"); localStorage.removeItem("sentinel:profile"); } catch {}
    toast.success("Signed out successfully");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[color:var(--background)]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/vanguard-logo.png" alt="VanGuard Shield" className="h-7 w-auto object-contain" />
            <span className="font-semibold">VanGuard Shield</span>
            <span className="ml-1 text-xs text-muted-foreground">Customer Portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/profile" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10">
              <CreditCard className="h-3.5 w-3.5" /> Profile
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
        {/* Dynamic Account strip */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <AccountCard label="Customer ID" value={cardNumber} icon={<CreditCard className="h-4 w-4" />} />
          <AccountCard label="Registered location" value={regLocation} icon={<MapPin className="h-4 w-4" />} />
          <AccountCard label="Last transaction" value={lastTxnText} icon={<TrendingUp className="h-4 w-4" />} />
          <AccountCard label="Account status" value="Active" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Terminal picker with Google Maps */}
          <section className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium">Select a terminal on Google Map</h2>
                <p className="text-xs text-muted-foreground">Click any marker or search by terminal name/ID.</p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search terminal..." className="w-40 bg-transparent py-1.5 text-xs outline-none" />
              </div>
            </div>
            <div className="mt-4">
              <GoogleTerminalMap
                terminals={filtered}
                selectedId={selected?.terminal_id ?? null}
                onSelect={(t) => setSelected(t as ApiTerminal)}
                userCoords={userLoc ? { lat: userLoc.lat, lng: userLoc.lon } : null}
                height="440px"
              />
            </div>
          </section>

          {/* Transaction form */}
          <section className="glass rounded-2xl p-5">
            <h2 className="font-medium">New transaction</h2>
            <p className="text-xs text-muted-foreground">Real-time fraud scoring powered by Sentinel ML.</p>

            <label className="mt-5 block text-xs text-muted-foreground">Selected terminal</label>
            <div className="mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm">
              {selected ? (
                <div>
                  <div className="font-mono text-sm">TRM-{selected.terminal_id}</div>
                  <div className="text-xs text-muted-foreground">{selected.terminal_name}</div>
                </div>
              ) : <span className="text-muted-foreground">No terminal selected</span>}
            </div>

            <label className="mt-4 block text-xs text-muted-foreground">Amount (USD)</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-full bg-transparent py-3 text-sm outline-none" />
            </div>

            <button
              onClick={submit}
              disabled={phase === "predicting"}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-70"
            >
              {phase === "predicting" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Scoring…</>) : (<>Submit transaction <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </section>
        </div>

        {/* Result & OTP Popups */}
        <AnimatePresence>
          {(phase === "result" || phase === "otp" || phase === "final") && prediction && (
            <motion.section
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3"
            >
              <div className={`glass-strong rounded-2xl p-6 lg:col-span-2 ${prediction.label === "fraud" ? "ring-1 ring-[color:var(--danger)]/40" : "ring-1 ring-[color:var(--success)]/30"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Prediction</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {phase === "final" && otpOutcome === "success"
                        ? "Verified Legitimate"
                        : prediction.label === "fraud" ? "Fraudulent" : "Legitimate"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Confidence {(prediction.confidence * 100).toFixed(1)}% · Risk {riskLevel(prediction.probability)}
                    </div>
                  </div>
                  <ProbabilityRing value={prediction.probability} label={prediction.label} />
                </div>

                <div className="mt-6 space-y-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Feature contributions</div>
                  {prediction.contributions.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between text-sm">
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.impact} impact</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-full rounded-full ${c.direction === 1 ? "bg-[color:var(--danger)]" : "bg-[color:var(--success)]"}`}
                          style={{ width: `${Math.round(c.value * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {prediction.label === "fraud" && phase !== "final" && (
                    <button onClick={startOtp} className="inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110">
                      <KeyRound className="h-4 w-4" /> Open OTP Verification Window
                    </button>
                  )}
                  {phase === "final" && (
                    <button onClick={reset} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10">
                      Make another transaction
                    </button>
                  )}
                </div>
              </div>

              {phase === "final" && (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="glass-strong rounded-2xl p-6">
                  {otpOutcome === "success" ? (
                    <>
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--success)]/15 text-[color:var(--success)]">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 font-semibold">Payment Approved</h3>
                      <p className="mt-1 text-xs text-muted-foreground">OTP was verified successfully. The transaction was processed.</p>
                    </>
                  ) : (
                    <>
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--danger)]/15 text-[color:var(--danger)]">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3 font-semibold">Payment Blocked</h3>
                      <p className="mt-1 text-xs text-muted-foreground">OTP verification failed or timed out. Transaction declined as fraudulent.</p>
                    </>
                  )}
                </motion.div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Most Recent Transactions History Table */}
        <section className="glass rounded-2xl p-6 mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white">
                <History className="h-4 w-4 text-[color:var(--cyan)]" />
              </div>
              <div>
                <h2 className="font-semibold text-base">Most Recent Transactions</h2>
                <p className="text-xs text-muted-foreground">Your recent card activity and verification status.</p>
              </div>
            </div>
            <button
              onClick={refreshHistory}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-white transition"
            >
              Refresh
            </button>
          </div>

          {recentTxns.length === 0 ? (
            <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
              No transactions recorded yet. Submit your first payment above!
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted-foreground border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Transaction ID</th>
                    <th className="py-2.5 px-3 font-medium">Terminal</th>
                    <th className="py-2.5 px-3 font-medium">Date &amp; Time</th>
                    <th className="py-2.5 px-3 font-medium">Amount</th>
                    <th className="py-2.5 px-3 font-medium">Risk Score</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentTxns.map((tx) => {
                    const badge = getStatusBadge(tx.status);
                    return (
                      <tr key={tx.transaction_id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                          {tx.transaction_id.slice(0, 12)}…
                        </td>
                        <td className="py-3 px-3 font-medium text-xs">
                          TRM-{tx.terminal_id}
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {new Date(tx.tx_datetime).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-semibold text-sm">
                          ${tx.tx_amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-xs font-mono">
                          p={(tx.fraud_probability ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Interactive OTP Pop-Up Window Modal */}
        <AnimatePresence>
          {phase === "otp" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Dimmed Backdrop with Blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPhase("result")}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />

              {/* Pop-Up Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-2xl"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-lg">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-white">Security OTP Verification</h3>
                      <p className="text-xs text-muted-foreground">VanGuard Shield Fraud Protection</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs font-medium text-amber-400">
                    <span>⏱</span> {formatTimer(otpSeconds)}
                  </div>
                </div>

                {/* Warning Notification Banner */}
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200/90">
                  <div className="flex items-center gap-2 font-medium text-amber-300">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>High-Risk Transaction Flagged</span>
                  </div>
                  <p className="mt-1">
                    We sent a 6-digit verification code to your registered phone number via SMS / WhatsApp. Enter it below to authorize this payment.
                  </p>
                </div>

                {/* OTP Input Form */}
                <div className="mt-5">
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    6-Digit Verification Code
                  </label>
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    autoFocus
                    className="mt-2 w-full rounded-2xl border border-white/15 bg-black/60 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={verifyOtp}
                    className="w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-glow)] transition hover:brightness-110 active:scale-[0.99]"
                  >
                    Confirm &amp; Authorize Transaction
                  </button>
                  <button
                    onClick={() => setPhase("result")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-white"
                  >
                    Close / Return to Transaction
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function AccountCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "success" }) {
  const color = tone === "success" ? "text-[color:var(--success)]" : "text-foreground";
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={`mt-2 font-mono text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function ProbabilityRing({ value, label }: { value: number; label: "legit" | "fraud" }) {
  const stroke = label === "fraud" ? "var(--danger)" : "var(--success)";
  const pct = Math.round(value * 100);
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
        <circle
          cx="48" cy="48" r={r} stroke={stroke} strokeWidth="8" fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono text-lg font-bold">{pct}%</span>
        <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      </div>
    </div>
  );
}

function riskLevel(prob: number) {
  if (prob > 0.8) return "Critical";
  if (prob > 0.55) return "High";
  if (prob > 0.3) return "Moderate";
  return "Low";
}
