import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, CreditCard, Lock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { NetworkBackdrop } from "@/components/network-backdrop";
import { authApi, setAdminToken, setCustomerToken, setCustomer } from "@/lib/api";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [cardNumber, setCardNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sentinel:lastCardNumber");
      if (saved) setCardNumber(saved);
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || password.length < 6) {
      toast.error("Enter your card number and password");
      return;
    }
    const id = parseInt(cardNumber, 10);
    if (isNaN(id)) {
      toast.error("Card number must be a valid number");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login(id, password);
      try { localStorage.setItem("sentinel:lastCardNumber", String(res.customer_id)); } catch {}
      toast.success("Signed in");
      if (res.role === "admin") {
        setAdminToken(res.token);
        navigate({ to: "/dashboard" });
      } else {
        setCustomerToken(res.token);
        setCustomer(res);
        navigate({ to: "/pay" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed. Please check your credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <NetworkBackdrop />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <Link to="/" className="mb-8 inline-flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
          <img src="/vanguard-logo.png" alt="VanGuard Shield" className="h-10 w-auto object-contain" />
          <span className="font-semibold text-lg text-foreground">VanGuard Shield</span>
        </Link>
        <motion.form
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          onSubmit={submit}
          className="glass-strong rounded-2xl p-7"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your card number.</p>

          <label className="mt-6 block text-xs text-muted-foreground">Card Number (Customer ID)</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <input
              value={cardNumber} onChange={(e) => setCardNumber(e.target.value)}
              inputMode="numeric" placeholder="10000000"
              className="w-full bg-transparent py-3 font-mono text-sm outline-none"
            />
          </div>

          <label className="mt-4 block text-xs text-muted-foreground">Password</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              value={password} onChange={(e) => setPassword(e.target.value)}
              type="password" placeholder="••••••••"
              className="w-full bg-transparent py-3 text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-70"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
          </button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            No card yet? <Link to="/register" className="text-foreground hover:underline">Register</Link>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Fraud analyst? <Link to="/dashboard" className="text-foreground hover:underline">Open dashboard</Link>
          </p>
        </motion.form>
      </div>
    </div>
  );
}
