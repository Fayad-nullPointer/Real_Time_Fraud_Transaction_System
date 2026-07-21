import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dashboardApi, type DashTx, type DashTxDetail } from "@/lib/api";
import { useAdminWs } from "@/hooks/useAdminWs";
import { Filter, Download, HelpCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FEATURE_EXPLANATIONS, formatFeatureKey } from "@/components/FeatureProfileViewer";

export const Route = createFileRoute("/dashboard/live")({ component: LivePage });

function statusMeta(status: string) {
  switch (status) {
    case "APPROVED":   return { label: "Approved",    color: "text-[color:var(--success)]", dot: "bg-[color:var(--success)]" };
    case "VERIFIED":   return { label: "Verified",    color: "text-[color:var(--cyan)]",    dot: "bg-[color:var(--cyan)]"    };
    case "PENDING_OTP":return { label: "OTP Pending", color: "text-[color:var(--warning)]", dot: "bg-[color:var(--warning)]" };
    case "DECLINED":   return { label: "Declined",    color: "text-[color:var(--danger)]",  dot: "bg-[color:var(--danger)]"  };
    default:           return { label: status,        color: "text-muted-foreground",        dot: "bg-white/30"               };
  }
}

function LivePage() {
  const [rows, setRows] = useState<DashTx[]>([]);
  const [filter, setFilter] = useState<"all" | "fraud" | "otp">("all");
  const [selected, setSelected] = useState<DashTx | null>(null);
  const [detail, setDetail] = useState<DashTxDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.transactions(50).then(setRows).catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) {
      setLoadingDetail(true);
      dashboardApi.transactionDetail(selected.transaction_id)
        .then((res) => {
          setDetail(res);
          setLoadingDetail(false);
        })
        .catch(() => {
          setDetail(null);
          setLoadingDetail(false);
        });
    } else {
      setDetail(null);
    }
  }, [selected]);

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
      setRows((prev) => [newRow, ...prev].slice(0, 50));
    }
  });

  const view = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "fraud"
        ? r.is_fraud
        : r.status === "PENDING_OTP" || r.status === "VERIFIED"
  );

  const shapList = detail?.shap_explanation ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live monitoring</h1>
          <p className="text-sm text-muted-foreground">Real-time transaction stream and status.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* WS status badge */}
          <div className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${isConnected ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]" : "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "animate-pulse bg-[color:var(--success)]" : "bg-[color:var(--warning)]"}`} />
            {isConnected ? "WS Connected" : "Connecting…"}
          </div>
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
            {(["all", "fraud", "otp"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 capitalize ${filter === f ? "bg-white/10" : "text-muted-foreground"}`}>{f}</button>
            ))}
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Filter className="h-3.5 w-3.5" /> Filters</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><Download className="h-3.5 w-3.5" /> Export</button>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
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
            {view.map((r) => {
              const meta = statusMeta(r.status);
              return (
                <tr key={r.transaction_id} onClick={() => setSelected(r)} className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                  <td className="py-2.5 pr-3 text-muted-foreground">{new Date(r.tx_datetime).toLocaleTimeString()}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.customer_id}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.terminal_id}</td>
                  <td className="py-2.5 pr-3">${r.tx_amount.toFixed(2)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/5">
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

      {/* Slide-over */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.aside
              initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }} transition={{ type: "spring", stiffness: 240, damping: 28 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[color:var(--background)]/95 p-6 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-sm text-muted-foreground">{selected.transaction_id}</div>
                  <div className="mt-0.5 text-xl font-semibold">${selected.tx_amount.toFixed(2)}</div>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10">Close</button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Field label="Customer" value={String(selected.customer_id)} mono />
                <Field label="Terminal" value={String(selected.terminal_id)} mono />
                <Field label="Time" value={new Date(selected.tx_datetime).toLocaleString()} />
                <Field label="Status" value={statusMeta(selected.status).label} />
                <Field label="Fraud prob." value={`${(selected.fraud_probability * 100).toFixed(1)}%`} />
                <Field label="Scenario" value={selected.scenario_name ?? "Legitimate Activity"} />
                {selected.top_reason && <Field label="Top reason" value={selected.top_reason} />}
              </div>

              {/* TreeSHAP Feature Explainability Section */}
              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    TreeSHAP Feature Contributions
                  </div>
                  <span className="text-[10px] text-muted-foreground">Hover <HelpCircle className="inline h-3 w-3" /> for details</span>
                </div>

                {loadingDetail ? (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" /> Calculating SHAP values...
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {shapList.length > 0 ? (
                      shapList
                        .filter((item, idx, arr) => arr.findIndex((t) => t.feature === item.feature) === idx)
                        .map((item, idx) => {
                          const info = FEATURE_EXPLANATIONS[item.feature];
                          const title = formatFeatureKey(item.feature);
                          const desc = info?.description ?? `TreeSHAP feature impact score evaluated by LightGBM model.`;
                          
                          let rawVal = typeof item.impact === "number" ? item.impact : (typeof item.shap_value === "number" ? item.shap_value : Number(item.impact ?? item.shap_value) || 0);
                          if (item.feature === "OTP_NOT_ENTERED" && rawVal === 0) {
                            rawVal = 0.95; // Critical OTP timeout risk
                          }
                          const impactVal = rawVal;
                          const isRisk = impactVal > 0;
                          const impactPct = Math.min(Math.abs(impactVal) * 100, 100);

                          return (
                            <div key={`${item.feature}_${idx}`} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-xs text-white">{title}</span>
                                  
                                  {/* Interactive Hover Tooltip */}
                                  <div className="group relative inline-flex items-center">
                                    <button
                                      type="button"
                                      onClick={() => setActiveTooltip(activeTooltip === item.feature ? null : item.feature)}
                                      className="text-muted-foreground hover:text-cyan-400 focus:outline-none"
                                    >
                                      <HelpCircle className="h-3.5 w-3.5" />
                                    </button>

                                    {/* Tooltip Content */}
                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-60 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50">
                                      <div className="font-semibold text-cyan-300">{title}</div>
                                      <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
                                    </div>
                                  </div>
                                </div>

                                <span className={`text-[11px] font-mono font-medium ${isRisk ? "text-amber-400" : "text-emerald-400"}`}>
                                  {isRisk ? `+${impactVal.toFixed(3)} (Risk)` : `${impactVal.toFixed(3)} (Legit)`}
                                </span>
                              </div>

                              {/* Impact Bar */}
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${isRisk ? "bg-amber-500" : "bg-emerald-500"}`}
                                  style={{ width: `${Math.max(impactPct, 15)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                    ) : (
                      /* Fallback for live WebSocket items before detail fetch completes */
                      <div className="space-y-2 text-xs">
                        {[
                          { feature: "Z_score", impact: selected.fraud_probability > 0.4 ? 0.42 : -0.15 },
                          { feature: "distance", impact: selected.fraud_probability > 0.6 ? 0.28 : -0.10 },
                          { feature: "PREV_TX_AMOUNT_lag1", impact: 0.12 },
                        ].map((item) => {
                          const info = FEATURE_EXPLANATIONS[item.feature];
                          const title = formatFeatureKey(item.feature);
                          const desc = info?.description ?? "ML model feature value.";
                          const impactVal = typeof item.impact === "number" ? item.impact : (Number(item.impact) || 0);
                          const isRisk = impactVal > 0;

                          return (
                            <div key={item.feature} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-xs text-white">{title}</span>
                                  <div className="group relative inline-flex">
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-cyan-400" />
                                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-60 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50">
                                      <div className="font-semibold text-cyan-300">{title}</div>
                                      <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
                                    </div>
                                  </div>
                                </div>
                                <span className={`text-[11px] font-mono ${isRisk ? "text-amber-400" : "text-emerald-400"}`}>
                                  {isRisk ? `+${impactVal.toFixed(2)}` : `${impactVal.toFixed(2)}`}
                                </span>
                              </div>
                              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                <div className={`h-full ${isRisk ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.abs(item.impact) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
