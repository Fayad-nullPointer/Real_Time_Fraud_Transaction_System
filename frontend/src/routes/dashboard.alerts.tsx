import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dashboardApi, type DashAlert } from "@/lib/api";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/dashboard/alerts")({ component: AlertsPage });

function AlertsPage() {
  const [alertList, setAlertList] = useState<DashAlert[]>([]);

  useEffect(() => {
    const fetch = () => dashboardApi.alerts().then(setAlertList).catch(console.error);
    fetch();
    const iv = setInterval(fetch, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">All active fraud alerts, prioritised by severity.</p>
      </div>

      {alertList.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-[color:var(--success)]/5 py-16 text-center">
          <CheckCircle className="h-8 w-8 text-[color:var(--success)]" />
          <div className="text-sm font-medium">No active alerts — system is healthy</div>
          <div className="text-xs text-muted-foreground">Alerts refresh automatically every 30 seconds.</div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {alertList.map((a, i) => {
            const tone = a.severity === "danger" ? "text-[color:var(--danger)]" : a.severity === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--cyan)]";
            const bg   = a.severity === "danger" ? "bg-[color:var(--danger)]/10" : a.severity === "warning" ? "bg-[color:var(--warning)]/10" : "bg-[color:var(--cyan)]/10";
            return (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className={`flex items-start gap-3 rounded-2xl border border-white/5 p-4 ${bg}`}
              >
                <AlertTriangle className={`mt-0.5 h-4 w-4 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.message}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{a.time}</div>
                </div>
                <button className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                  Acknowledge
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
