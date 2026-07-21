import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Phone, Lock, MapPin, Loader2, CheckCircle2, Copy, User } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { NetworkBackdrop } from "@/components/network-backdrop";
import { authApi, setToken, setCustomer } from "@/lib/api";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "locating" | "done">("form");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cardNumber, setCardNumber] = useState<string>("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || password.length < 6) {
      toast.error("Enter a valid phone and a 6+ character password");
      return;
    }
    setStep("locating");
    const getLoc = new Promise<{ lat: number; lng: number }>((resolve) => {
      if (!("geolocation" in navigator)) {
        resolve({ lat: 40.7128, lng: -74.006 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: 40.7128, lng: -74.006 }),
        { timeout: 5000 }
      );
    });
    const c = await getLoc;
    setCoords(c);
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }
    try {
      const res = await authApi.register({
        phone_number: formattedPhone,
        password,
        full_name: fullName || undefined,
        lat: c.lat,
        lon: c.lng,
      });
      setToken(res.token);
      setCustomer(res);
      setCardNumber(String(res.customer_id));
      try {
        localStorage.setItem("sentinel:lastCardNumber", String(res.customer_id));
        localStorage.setItem("sentinel:cardNumber", String(res.customer_id));
      } catch {}
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      toast.error(msg);
      setStep("form");
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

        {step !== "done" ? (
          <motion.form
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={submit}
            className="glass-strong rounded-2xl p-7"
          >
            <h1 className="text-2xl font-semibold tracking-tight">Create your card</h1>
            <p className="mt-1 text-sm text-muted-foreground">Register with your phone number. We'll issue a Customer ID that acts as your card number.</p>

            <label className="mt-6 block text-xs text-muted-foreground">Full name (optional)</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <input
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>

            <label className="mt-4 block text-xs text-muted-foreground">Phone number</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <input
                value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 010 4477"
                className="w-full bg-transparent py-3 text-sm outline-none"
                inputMode="tel"
              />
            </div>

            <label className="mt-4 block text-xs text-muted-foreground">Password</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <input
                value={password} onChange={(e) => setPassword(e.target.value)}
                type="password" placeholder="6+ characters"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-[color:var(--cyan)]" />
              We'll capture your approximate location during signup for risk scoring.
            </div>

            <button
              type="submit"
              disabled={step === "locating"}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-70"
            >
              {step === "locating" ? (<><Loader2 className="h-4 w-4 animate-spin" /> Locating…</>) : "Create card"}
            </button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already have a card? <Link to="/login" className="text-foreground hover:underline">Sign in</Link>
            </p>
          </motion.form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-strong rounded-2xl p-7"
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--success)]/15 ring-1 ring-[color:var(--success)]/30">
              <CheckCircle2 className="h-6 w-6 text-[color:var(--success)]" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">You're all set</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your new card has been provisioned. Use the number below to sign in.</p>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-5">
              <div className="text-xs text-muted-foreground">Your Card Number (Customer ID)</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="font-mono text-2xl tracking-wider gradient-text">{cardNumber}</div>
                <button
                  onClick={() => { navigator.clipboard.writeText(cardNumber); toast.success("Copied"); }}
                  className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {coords && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  Location captured: {coords.lat.toFixed(3)}, {coords.lng.toFixed(3)}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate({ to: "/login" })}
              className="mt-6 w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110"
            >
              Continue to sign in
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
