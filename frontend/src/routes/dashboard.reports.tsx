import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dashboardApi, type DashReport } from "@/lib/api";
import { FileText, Search, ShieldAlert, CheckCircle, AlertTriangle, User, MapPin, DollarSign, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/reports")({ component: ReportsPage });

function ReportsPage() {
  const [reports, setReports] = useState<DashReport[]>([]);
  const [filter, setFilter] = useState<"all" | "reported" | "declined">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<DashReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReports = () => {
    setLoading(true);
    dashboardApi.reports()
      .then((res) => {
        setReports(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = reports.filter((r) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "reported"
          ? r.status === "REPORTED_FRAUD"
          : r.status === "DECLINED";

    if (!matchesFilter) return false;
    if (!q) return true;

    const query = q.toLowerCase();
    return (
      r.transaction_id.toLowerCase().includes(query) ||
      String(r.customer_id).includes(query) ||
      String(r.terminal_id).includes(query) ||
      r.scenario.toLowerCase().includes(query) ||
      r.customer_statement.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-rose-400" /> Customer Reports & Audit Claims
          </h1>
          <p className="text-sm text-muted-foreground">
            Customer-submitted unauthorized transaction claims, card skimming reports, and 2FA OTP audit logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter Tabs */}
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
            {[
              { label: "All Claims", val: "all" },
              { label: "Reported Fraud", val: "reported" },
              { label: "OTP Declines", val: "declined" },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => setFilter(f.val as typeof filter)}
                className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                  filter === f.val ? "bg-white/10 text-white font-medium" : "text-muted-foreground hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search TX, customer ID, scenario…"
              className="w-56 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filtered.length > 0 ? (
          filtered.map((r) => {
            const isReported = r.status === "REPORTED_FRAUD";
            const badgeColor = isReported
              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
              : "bg-amber-500/10 text-amber-400 border-amber-500/20";

            return (
              <div
                key={r.transaction_id}
                onClick={() => setSelected(r)}
                className="glass cursor-pointer rounded-2xl p-5 border border-white/5 hover:border-white/20 transition-all hover:bg-white/[0.02] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                        {isReported ? <ShieldAlert className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {isReported ? "UNAUTHORIZED CLAIM" : "OTP AUTO-DECLINED"}
                      </span>
                      <h3 className="mt-2 text-base font-semibold text-white">{r.scenario}</h3>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">${r.amount.toFixed(2)}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-cyan-400" /> Customer <span className="font-mono text-white">#{r.customer_id}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-400" /> Terminal <span className="font-mono text-white">#{r.terminal_id}</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-slate-300 leading-relaxed italic">
                    "{r.customer_statement}"
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
                  <span className="font-mono text-muted-foreground text-[11px]">TX: {r.transaction_id.slice(0, 16)}…</span>
                  <span className="text-cyan-400 hover:underline font-medium">Investigate Claim →</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass col-span-full rounded-2xl p-12 text-center text-sm text-muted-foreground">
            No customer reports found matching the specified criteria.
          </div>
        )}
      </div>

      {/* Slide-over Investigation Panel */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            <motion.aside
              initial={{ x: 480 }}
              animate={{ x: 0 }}
              exit={{ x: 480 }}
              transition={{ type: "spring", stiffness: 240, damping: 28 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[color:var(--background)]/95 p-6 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold">Incident Audit Detail</div>
                  <div className="mt-0.5 text-xl font-bold text-white">${selected.amount.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Report Statement</div>
                  <p className="text-xs text-slate-200 leading-relaxed italic">"{selected.customer_statement}"</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-muted-foreground">Transaction ID</div>
                    <div className="font-mono text-white font-medium mt-0.5">{selected.transaction_id}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-muted-foreground">Status</div>
                    <div className="font-semibold text-rose-400 mt-0.5">{selected.status}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-muted-foreground">Customer ID</div>
                    <div className="font-mono text-white font-medium mt-0.5">#{selected.customer_id}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="text-muted-foreground">Terminal ID</div>
                    <div className="font-mono text-white font-medium mt-0.5">#{selected.terminal_id}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
                  <div className="text-xs font-semibold text-white uppercase tracking-wider">Analyst Decision Actions</div>
                  
                  <button
                    onClick={() => {
                      toast.success(`Marked TX #${selected.transaction_id.slice(0, 8)} as confirmed fraud incident.`);
                      setSelected(null);
                    }}
                    className="w-full rounded-xl bg-rose-500/20 border border-rose-500/30 p-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShieldAlert className="h-4 w-4" /> Confirm Fraud Incident & Block Card
                  </button>

                  <button
                    onClick={() => {
                      toast.success(`Marked TX #${selected.transaction_id.slice(0, 8)} as false positive.`);
                      setSelected(null);
                    }}
                    className="w-full rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="h-4 w-4" /> Resolve as Legitimate Customer Activity
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
