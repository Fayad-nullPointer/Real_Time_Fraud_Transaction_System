import { useEffect, useState } from "react";
import { Play, Square, RefreshCw, Zap, Gauge, CheckCircle2, ShieldAlert } from "lucide-react";
import { streamApi } from "@/lib/api";
import { toast } from "sonner";

export function KafkaStreamControl() {
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(0.8);
  const [maxTx, setMaxTx] = useState(100);
  const [dataset, setDataset] = useState("test_transactions_first_200.csv");
  const [stats, setStats] = useState({
    processed: 0,
    approved: 0,
    blocked: 0,
    fraud_count: 0,
  });
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await streamApi.status();
      setIsRunning(res.is_running);
      if (res.dataset) setDataset(res.dataset);
      setStats({
        processed: res.processed,
        approved: res.approved,
        blocked: res.blocked,
        fraud_count: res.fraud_count,
      });
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await streamApi.start(speed, maxTx, dataset);
      setIsRunning(true);
      toast.success(res.message ?? "Kafka stream started!");
      fetchStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start Kafka stream");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await streamApi.stop();
      setIsRunning(false);
      toast.info(res.message ?? "Kafka stream stopped.");
      fetchStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to stop Kafka stream");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl p-5 border border-white/10 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/20 text-cyan-400">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base text-white">Kafka Stream Simulator</h3>
              {isRunning ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                  Streaming Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted-foreground">
                  ⚪ Idle (Stopped)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Run &amp; simulate real-time Kafka transaction streaming directly from the Web GUI.
            </p>
          </div>
        </div>

        {/* Start / Stop Buttons */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-white" />
              <span>Start Kafka Stream</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStop}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              <Square className="h-4 w-4 fill-white" />
              <span>Stop Stream</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchStatus}
            title="Refresh Status"
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-muted-foreground hover:bg-white/10 hover:text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Controls & Metrics Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Source Dataset Option */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Source Dataset</label>
          <select
            value={dataset}
            onChange={(e) => setDataset(e.target.value)}
            disabled={isRunning}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-cyan-300 font-medium outline-none focus:border-cyan-400"
          >
            <option value="test_transactions_first_200.csv">Uploaded Test File (200 rows)</option>
            <option value="synthetic_fraud_transactions.csv">Full Dataset</option>
          </select>
        </div>

        {/* Speed Option */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Stream Speed</label>
          <select
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            disabled={isRunning}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
          >
            <option value={0.2}>Fast (0.2s / tx)</option>
            <option value={0.5}>Normal (0.5s / tx)</option>
            <option value={0.8}>Standard (0.8s / tx)</option>
            <option value={1.5}>Slow (1.5s / tx)</option>
          </select>
        </div>

        {/* Limit Option */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Max Transactions</label>
          <select
            value={maxTx}
            onChange={(e) => setMaxTx(parseInt(e.target.value, 10))}
            disabled={isRunning}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
          >
            <option value={10}>10 Transactions</option>
            <option value={50}>50 Transactions</option>
            <option value={100}>100 Transactions</option>
            <option value={200}>200 Transactions</option>
            <option value={500}>500 Transactions</option>
          </select>
        </div>

        {/* Processed Stats */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Processed</div>
          <div className="mt-1 flex items-baseline gap-1 font-mono text-xl font-bold text-white">
            {stats.processed} <span className="text-xs text-muted-foreground">/ {maxTx}</span>
          </div>
        </div>

        {/* Fraud Flagged Stats */}
        <div className="rounded-xl border border-white/5 bg-black/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Fraud Flagged</div>
          <div className="mt-1 font-mono text-xl font-bold text-rose-400">
            {stats.fraud_count}
          </div>
        </div>
      </div>
    </div>
  );
}
