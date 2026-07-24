import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dashboardApi, type LogEntry } from "@/lib/api";
import { Terminal, Search, Filter, RefreshCw, ChevronDown, ChevronRight, Layers } from "lucide-react";
import { KafkaStreamControl } from "@/components/KafkaStreamControl";

export const Route = createFileRoute("/dashboard/logs")({ component: LogsPage });

function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchLogs = () => {
    setLoading(true);
    dashboardApi.logs(200, levelFilter)
      .then((data) => {
        setLogs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, [levelFilter]);

  const filtered = logs.filter((l) => {
    if (!q) return true;
    const searchStr = q.toLowerCase();
    return (
      (l.message && l.message.toLowerCase().includes(searchStr)) ||
      (l.name && l.name.toLowerCase().includes(searchStr)) ||
      (l.transaction_id && String(l.transaction_id).toLowerCase().includes(searchStr)) ||
      (l.event_type && l.event_type.toLowerCase().includes(searchStr))
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Terminal className="h-6 w-6 text-cyan-400" /> Kafka Event Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time event stream from Kafka topics, ML inference pipeline, and microservices.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Level Filter Buttons */}
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
            {[
              { label: "All Levels", val: "" },
              { label: "INFO", val: "INFO" },
              { label: "WARN", val: "WARNING" },
              { label: "ERROR", val: "ERROR" },
            ].map((f) => (
              <button
                key={f.val}
                onClick={() => setLevelFilter(f.val)}
                className={`rounded-md px-2.5 py-1 capitalize transition-colors ${
                  levelFilter === f.val ? "bg-white/10 text-white font-medium" : "text-muted-foreground hover:text-white"
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
              placeholder="Filter by TX, topic or keyword…"
              className="w-56 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* GUI Kafka Stream Simulator Controller */}
      <KafkaStreamControl />

      {/* Log Terminal Container */}
      <div className="glass rounded-2xl p-4 font-mono text-xs overflow-hidden border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 text-muted-foreground text-[11px]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Kafka Topic: <span className="text-white font-semibold">fraud.transactions.v1</span></span>
          </div>
          <div>{filtered.length} events retrieved</div>
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-1.5 max-h-[640px] overflow-y-auto pr-1">
            {filtered.map((entry, idx) => {
              const isExpanded = expandedIndex === idx;
              const isError = entry.level?.toUpperCase() === "ERROR";
              const isWarn = entry.level?.toUpperCase() === "WARN" || entry.level?.toUpperCase() === "WARNING";
              
              const levelBadgeColor = isError
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : isWarn
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";

              return (
                <div
                  key={idx}
                  className="rounded-xl border border-white/5 bg-black/40 p-2.5 transition-colors hover:border-white/10"
                >
                  <div
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="flex items-start justify-between cursor-pointer gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button className="text-muted-foreground hover:text-white">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "—"}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0 ${levelBadgeColor}`}>
                        {entry.level ?? "INFO"}
                      </span>
                      <span className="text-cyan-300 text-[11px] shrink-0 font-medium">{entry.name ?? "sentinel"}</span>
                      <span className="text-slate-200 truncate leading-relaxed">{entry.message}</span>
                    </div>

                    {entry.transaction_id && (
                      <span className="shrink-0 rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground font-mono">
                        TX: {entry.transaction_id}
                      </span>
                    )}
                  </div>

                  {/* Expanded JSON Event Payload */}
                  {isExpanded && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-slate-950 p-3 text-[11px] text-slate-300 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 border-b border-white/10 pb-1.5">
                        <Layers className="h-3.5 w-3.5" /> Kafka Event Payload & Metadata
                      </div>
                      <pre className="overflow-x-auto text-[10px] leading-relaxed text-emerald-300">
                        {JSON.stringify(entry, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No Kafka events found matching the specified log level or search query.
          </div>
        )}
      </div>
    </div>
  );
}
