import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Activity, ShieldCheck, Zap, LineChart, Cpu, Lock, ArrowRight,
  BarChart3, MapPin, Bell, CheckCircle2, Play,
} from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { NetworkBackdrop } from "@/components/network-backdrop";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <NetworkBackdrop />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 pt-20 pb-24 md:pt-28 md:pb-32 lg:grid-cols-12 lg:gap-10">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-6"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" />
              Live inference · v4.2 · 12ms p95
            </div>
            <h1 className="text-balance text-5xl font-bold leading-[1.02] tracking-tight md:text-[64px]">
              Stop fraud before
              <br />
              <span className="gradient-text">it reaches you.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Real-time transaction analysis in <span className="font-medium text-foreground">under 12 milliseconds</span>. One API call, instant verdict, zero friction for real customers. Drop it in today, stop the bleeding tomorrow.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:brightness-110"
              >
                Start building <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10"
              >
                <Play className="h-3.5 w-3.5" /> Watch live demo
              </Link>
            </div>

            <div className="mt-12 border-t border-white/5 pt-6">
              <div className="mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Stops at the edge</div>
              <div className="flex flex-wrap gap-2">
                {["Card testing", "Account takeover", "OTP abuse", "Promo abuse", "Bot signups", "SMS pumping"].map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right: dashboard mock */}
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-6"
          >
            <DashboardMock />
          </motion.div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="relative border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 max-w-2xl">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--cyan)]">Platform</div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Built for security teams that can't afford to blink.
            </h2>
            <p className="mt-3 text-muted-foreground">
              End-to-end tooling from ingestion to explainable decisions, wired for the
              speed and scale of modern card networks.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="glass group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)]/20 ring-1 ring-white/10">
                  <f.icon className="h-5 w-5 text-[color:var(--cyan)]" />
                </div>
                <div className="font-medium">{f.title}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="docs" className="relative border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-12 max-w-2xl">
            <div className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--cyan)]">02 · How it works</div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              From one API call to catching fraud in five minutes.
            </h2>
            <p className="mt-3 text-muted-foreground">No agents, no sidecars, no heavy review tooling. Three steps and you're on the critical path.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-4">
            {steps.map((s, i) => (
              <motion.li
                key={s.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="glass relative rounded-2xl p-6"
              >
                <div className="mb-4 text-[11px] tracking-[0.18em] text-muted-foreground">STEP {String(i + 1).padStart(2, "0")}</div>
                <s.icon className="mb-3 h-5 w-5 text-[color:var(--purple)]" />
                <div className="font-medium">{s.title}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="relative border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="glass-strong relative overflow-hidden rounded-3xl p-10 md:p-14">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[color:var(--primary)]/30 blur-3xl" />
            <div className="absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[color:var(--purple)]/25 blur-3xl" />
            <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h3 className="text-2xl font-semibold md:text-3xl">Explore the live demo.</h3>
                <p className="mt-2 max-w-lg text-muted-foreground">
                  Simulate transactions from the customer portal, watch them flow into the
                  analyst dashboard, and observe adaptive OTP verification in action.
                </p>
              </div>
              <div className="flex gap-3">
                <Link to="/register" className="rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110">
                  Simulate a transaction
                </Link>
                <Link to="/dashboard" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10">
                  Analyst dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <div>© {new Date().getFullYear()} Sentinel — AI Fraud Detection Platform</div>
          <div>Demo environment · Do not use with production card data</div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: Cpu, title: "Real-time inference", desc: "Sub-20ms fraud scores from a gradient-boosted ensemble tuned on billions of transactions." },
  { icon: MapPin, title: "Geospatial signals", desc: "Distance-from-home, velocity checks and terminal risk propagation baked in." },
  { icon: Lock, title: "Adaptive OTP", desc: "Suspicious transactions trigger step-up verification via Twilio Verify — not hard blocks." },
  { icon: BarChart3, title: "Explainable decisions", desc: "SHAP-based feature contributions surfaced with every prediction." },
  { icon: Bell, title: "Live alerting", desc: "Priority-ranked alerts for hotspots, terminal drift and unusual customer behaviour." },
  { icon: LineChart, title: "Enterprise analytics", desc: "Model drift, fraud rate cohorts and OTP correction dashboards for auditors." },
];

const steps = [
  { icon: Activity, title: "Ingest", desc: "Transactions stream in with terminal, amount and location metadata." },
  { icon: Zap, title: "Feature engineer", desc: "Rolling stats, distance, night-flag and terminal drift computed in-flight." },
  { icon: ShieldCheck, title: "Predict", desc: "Model returns probability, confidence and top feature contributions." },
  { icon: CheckCircle2, title: "Verify", desc: "Adaptive OTP step-up for edge cases; final decision logged for audit." },
];

/* ---------------- Dashboard mock ---------------- */

type Verdict = "allow" | "block" | "alert";
type Row = {
  id: number;
  time: string;
  verdict: Verdict;
  flag: string;
  method: string;
  path: string;
  ms: string;
};

const FLAGS = ["🇬🇧", "🇺🇸", "🇩🇪", "🇧🇷", "🇯🇵", "🇫🇷", "🇮🇳", "🇨🇦", "🇦🇺", "🇳🇱"];
const PATHS = [
  { path: "/login", verdictBias: "allow" as Verdict },
  { path: "/payment", verdictBias: "block" as Verdict },
  { path: "/signup", verdictBias: "allow" as Verdict },
  { path: "/otp", verdictBias: "alert" as Verdict },
  { path: "/checkout", verdictBias: "allow" as Verdict },
];

function timeString(d = new Date()) {
  return d.toTimeString().slice(0, 8);
}

function makeRow(id: number): Row {
  const p = PATHS[Math.floor(Math.random() * PATHS.length)];
  const r = Math.random();
  const verdict: Verdict =
    r < 0.62 ? "allow" : r < 0.85 ? (p.verdictBias === "alert" ? "alert" : "block") : "alert";
  return {
    id,
    time: timeString(),
    verdict,
    flag: FLAGS[Math.floor(Math.random() * FLAGS.length)],
    method: "POST",
    path: p.path,
    ms: (0.7 + Math.random() * 1.4).toFixed(1),
  };
}

function DashboardMock() {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 5 }).map((_, i) => makeRow(1000 - i)),
  );
  const [counter, setCounter] = useState(12481);

  useEffect(() => {
    const id = setInterval(() => {
      setRows((prev) => [makeRow(prev[0].id + 1), ...prev].slice(0, 5));
      setCounter((c) => c + Math.floor(3 + Math.random() * 12));
    }, 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass-strong rounded-2xl p-3 shadow-[var(--shadow-glow)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)]/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--warning)]/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--success)]/70" />
        <div className="ml-3 flex items-center gap-1.5 rounded-md border border-white/5 bg-black/30 px-2 py-0.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" /> sentinel.ai <span className="text-white/30">/</span> dashboard
        </div>
      </div>

      {/* Top card: fraud blocked */}
      <div className="p-3 pb-2">
        <div className="rounded-xl border border-white/5 bg-black/30 p-4">
          <div className="flex items-center gap-4">
            <Donut value={93} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fraud blocked / 24h</div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-2 py-0.5 text-[10px] text-[color:var(--success)]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" /> LIVE
                </div>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <motion.div
                  key={counter}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="text-3xl font-semibold tracking-tight tabular-nums"
                >
                  {counter.toLocaleString()}
                </motion.div>
                <div className="text-xs text-muted-foreground">requests</div>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                <span className="text-[color:var(--success)]">↑ 14%</span> vs yesterday · 2.8ms avg latency
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 px-3">
        <MiniKPI label="p99 latency" tag="SLA" value="2.8" unit="ms" delta="-0.3ms" tone="cyan" trend="down" />
        <MiniKPI label="Block rate" tag="7d" value="18" unit="%" delta="+2.1pp" tone="danger" trend="up" />
      </div>

      {/* Live verdict stream */}
      <div className="p-3">
        <div className="rounded-xl border border-white/5 bg-black/30">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>Live verdict stream</span>
            <span className="inline-flex items-center gap-1.5 text-[color:var(--success)] normal-case tracking-normal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" /> streaming
            </span>
          </div>
          <ul className="divide-y divide-white/5 font-mono text-[11px]">
            <AnimatePresence initial={false}>
              {rows.map((r) => (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: -8, backgroundColor: "rgba(99,132,255,0.08)" }}
                  animate={{ opacity: 1, y: 0, backgroundColor: "rgba(0,0,0,0)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <span className="w-16 text-muted-foreground">{r.time}</span>
                  <VerdictBadge v={r.verdict} />
                  <span className="w-4 text-center">{r.flag}</span>
                  <span className="text-muted-foreground">{r.method}</span>
                  <span className="truncate">{r.path}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">{r.ms}ms</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </div>
  );
}

function VerdictBadge({ v }: { v: Verdict }) {
  const map = {
    allow: { c: "var(--success)", label: "allow" },
    block: { c: "var(--danger)", label: "block" },
    alert: { c: "var(--warning)", label: "alert" },
  }[v];
  return (
    <span
      className="inline-flex w-14 justify-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ color: map.c, borderColor: `color-mix(in oklab, ${map.c} 40%, transparent)`, background: `color-mix(in oklab, ${map.c} 10%, transparent)` }}
    >
      {map.label}
    </span>
  );
}

function Donut({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={r} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
        <motion.circle
          cx="30" cy="30" r={r}
          stroke="url(#donutGrad)"
          strokeWidth="6" strokeLinecap="round" fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="donutGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-sm font-semibold">{value}%</div>
    </div>
  );
}

function MiniKPI({
  label, tag, value, unit, delta, tone, trend,
}: {
  label: string; tag: string; value: string; unit: string; delta: string;
  tone: "cyan" | "danger"; trend: "up" | "down";
}) {
  const stroke = tone === "danger" ? "#EF4444" : "#60A5FA";
  const fill = tone === "danger" ? "rgba(239,68,68,0.18)" : "rgba(96,165,250,0.22)";
  const deltaColor = trend === "down" ? "var(--success)" : "var(--danger)";
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 p-3">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5">{tag}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{unit}</div>
        <div className="ml-auto rounded px-1.5 py-0.5 text-[10px]" style={{ color: deltaColor, background: `color-mix(in oklab, ${deltaColor} 12%, transparent)` }}>
          {delta}
        </div>
      </div>
      <Sparkline stroke={stroke} fill={fill} seed={tone === "danger" ? 4 : 1} trend={trend} />
    </div>
  );
}

function Sparkline({ stroke, fill, seed, trend }: { stroke: string; fill: string; seed: number; trend: "up" | "down" }) {
  const pts = useMemo(() => {
    const n = 28;
    const arr: { x: number; y: number }[] = [];
    let y = 24;
    for (let i = 0; i < n; i++) {
      const drift = trend === "up" ? -0.35 : 0.35;
      const pseudoRandom = Math.sin((i * 12.9898) + (seed * 78.233)) * 0.5;
      y += (Math.sin((i + seed) / 2.2) * 3) + pseudoRandom + drift;
      y = Math.max(6, Math.min(34, y));
      arr.push({ x: (i / (n - 1)) * 100, y });
    }
    return arr;
  }, [seed, trend]);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-2 h-10 w-full">
      <motion.path
        d={`${d} L 100 40 L 0 40 Z`}
        fill={fill}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
      />
      <motion.path
        d={d} fill="none" stroke={stroke} strokeWidth="1.4"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}
      />
    </svg>
  );
}
