import { createFileRoute } from "@tanstack/react-router";
import { dashboardApi, type DashTerminal } from "@/lib/api";
import { useEffect, useState } from "react";
import { GoogleTerminalMap } from "@/components/GoogleTerminalMap";

export const Route = createFileRoute("/dashboard/terminals")({ component: TerminalsPage });

function TerminalsPage() {
  const [terminals, setTerminals] = useState<DashTerminal[]>([]);
  const [selected, setSelected] = useState<DashTerminal | null>(null);

  useEffect(() => {
    dashboardApi.terminalStats()
      .then((data) => {
        setTerminals(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Terminals</h1>
        <p className="text-sm text-muted-foreground">Fraud rates and geographic distribution across the network.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-2">
          <GoogleTerminalMap
            terminals={terminals.map((t) => ({
              terminal_id: t.terminal_id,
              terminal_name: t.terminal_name,
              latitude: t.latitude,
              longitude: t.longitude,
              fraud_rate: t.fraud_rate_7d,
              risk_score: t.risk_score,
            }))}
            selectedId={selected?.terminal_id ?? null}
            onSelect={(t) => {
              const found = terminals.find((x) => x.terminal_id === t.terminal_id);
              if (found) setSelected(found);
            }}
            height="520px"
          />
        </div>

        {selected ? (
          <div className="glass rounded-2xl p-5">
            <div className="text-xs text-muted-foreground">Terminal</div>
            <div className="mt-0.5 font-mono text-lg">TRM-{selected.terminal_id}</div>
            <div className="text-sm text-muted-foreground">{selected.terminal_name}</div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Stat label="3-day" value={`${(selected.fraud_rate_3d * 100).toFixed(1)}%`} />
              <Stat label="7-day" value={`${(selected.fraud_rate_7d * 100).toFixed(1)}%`} />
              <Stat label="28-day" value={`${(selected.fraud_rate_28d * 100).toFixed(1)}%`} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Stat label="Total txns" value={selected.total_txns.toLocaleString()} />
              <Stat label="Fraud count" value={String(selected.fraud_count)} />
              <Stat label="Nearby incidents" value={String(selected.nearby_incidents)} />
              <Stat label="Risk score" value={String(selected.risk_score)} />
              <Stat label="Lat" value={selected.latitude.toFixed(4)} />
              <Stat label="Lng" value={selected.longitude.toFixed(4)} />
            </div>
          </div>
        ) : (
          <div className="glass flex items-center justify-center rounded-2xl p-5 text-sm text-muted-foreground">
            {terminals.length === 0 ? "Loading terminals…" : "Select a terminal"}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
