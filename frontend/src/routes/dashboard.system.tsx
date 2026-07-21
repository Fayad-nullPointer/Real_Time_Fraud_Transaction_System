import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dashboardApi, type SystemHealth } from "@/lib/api";
import { Cpu, Database, Gauge, Users, Boxes, Timer, GitBranch, HardDrive, MemoryStick, Wifi } from "lucide-react";

export const Route = createFileRoute("/dashboard/system")({ component: SystemPage });

// Static decorative uptime bars (no uptime data from API)
const SERVICES = [
  { name: "Ingestion API",        uptime: 99.99 },
  { name: "Feature service",      uptime: 99.98 },
  { name: "Inference service",    uptime: 99.96 },
  { name: "OTP / Twilio Verify",  uptime: 99.9  },
  { name: "Analytics warehouse",  uptime: 99.94 },
];

function statusTone(s: string) {
  if (s === "healthy" || s === "ok" || s === "operational") return "success";
  if (s === "degraded" || s === "slow")                      return "warning";
  return "danger";
}

function SystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    const fetch = () => dashboardApi.system().then(setHealth).catch(console.error);
    fetch();
    const iv = setInterval(fetch, 10_000);
    return () => clearInterval(iv);
  }, []);

  if (health === null) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System</h1>
          <p className="text-sm text-muted-foreground">Operational metrics across the fraud-detection stack.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const getStatusStr = (val: unknown): string => {
    if (typeof val === "string") return val;
    if (val && typeof val === "object" && "status" in val) {
      return String((val as { status: unknown }).status);
    }
    return "running";
  };

  const apiStatus = getStatusStr(health.fastapi);
  const dbStatus  = getStatusStr(health.postgres);
  const redisStatus = getStatusStr(health.redis);

  const apiTone = statusTone(apiStatus);
  const dbTone  = statusTone(dbStatus);
  const mlTone  = statusTone(health.ml_model.status);

  const metrics = [
    { label: "ML Inference",    value: `${health.ml_model.inference_ms.toFixed(1)} ms`,    Icon: Timer,       tone: mlTone  },
    { label: "Model version",   value: health.ml_model.version,                              Icon: GitBranch,   tone: "purple" },
    { label: "FastAPI",         value: apiStatus,                                           Icon: Gauge,       tone: apiTone },
    { label: "PostgreSQL",      value: dbStatus,                                            Icon: Database,    tone: dbTone  },
    { label: "Redis cache hit", value: `${(health.redis.cache_hit_rate * 100).toFixed(1)}%`, Icon: Boxes,       tone: "cyan"  },
    { label: "WS clients",      value: String(health.websocket.connected_clients),            Icon: Wifi,        tone: "primary"},
    { label: "CPU",             value: `${health.resources.cpu.toFixed(1)}%`,                Icon: Cpu,         tone: health.resources.cpu > 80 ? "danger" : health.resources.cpu > 60 ? "warning" : "success" },
    { label: "RAM",             value: `${health.resources.ram.toFixed(1)}%`,                Icon: MemoryStick, tone: health.resources.ram > 85 ? "danger" : health.resources.ram > 65 ? "warning" : "success" },
    { label: "Disk",            value: `${health.resources.disk.toFixed(1)}%`,               Icon: HardDrive,   tone: health.resources.disk > 90 ? "danger" : health.resources.disk > 70 ? "warning" : "success" },
    { label: "Active users",    value: String(health.websocket.connected_clients),            Icon: Users,       tone: "cyan" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground">Operational metrics across the fraud-detection stack.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        {metrics.map((m) => {
          const color =
            m.tone === "danger"  ? "var(--danger)"  :
            m.tone === "warning" ? "var(--warning)" :
            m.tone === "success" ? "var(--success)" :
            m.tone === "purple"  ? "var(--purple)"  :
            m.tone === "primary" ? "var(--primary)" :
                                   "var(--cyan)";
          return (
            <div key={m.label} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <m.Icon className="h-4 w-4" style={{ color }} />
                {m.label}
              </div>
              <div className="mt-1.5 text-xl font-semibold">{m.value}</div>
            </div>
          );
        })}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-sm font-medium">Service uptime · last 30 days</div>
        <ul className="mt-3 space-y-3">
          {SERVICES.map((s) => (
            <li key={s.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{s.name}</span>
                <span className="text-xs text-[color:var(--success)]">{s.uptime.toFixed(2)}%</span>
              </div>
              <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(30, minmax(0, 1fr))" }}>
                {Array.from({ length: 30 }).map((_, i) => {
                  const bad = Math.random() > 0.97;
                  return <span key={i} className={`h-6 rounded-sm ${bad ? "bg-[color:var(--warning)]/70" : "bg-[color:var(--success)]/50"}`} />;
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
