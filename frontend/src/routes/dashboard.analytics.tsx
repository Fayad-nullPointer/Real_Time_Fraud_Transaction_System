import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { dashboardApi, type AnalyticsCharts } from "@/lib/api";
import { HelpCircle } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";

export const Route = createFileRoute("/dashboard/analytics")({ component: AnalyticsPage });

export default function _unused() { return null; }

function AnalyticsPage() {
  const [charts, setCharts] = useState<AnalyticsCharts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi.analyticsCharts()
      .then(setCharts)
      .catch((err) => {
        console.error("Analytics fetch error:", err);
        setError("Failed to load analytics data.");
      });
  }, []);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-[color:var(--danger)]">{error}</div>
    );
  }

  if (charts === null) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">Model performance, fraud patterns and OTP outcomes.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass h-80 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass h-72 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const otpData = charts.otp_outcomes;
  const modelDist = charts.model_dist;
  const topScenarios = charts.top_scenarios;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Model performance, fraud patterns and OTP outcomes.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Fraud rate over time"
          subtitle="Rolling 24h"
          explanation="Real-time monitoring chart comparing total hourly payments (blue dashed line) against flagged fraud attempts (red line) over the last 24 hours. Use this to spot active fraud spikes happening right now."
        >
          <ResponsiveContainer>
            <LineChart data={charts.volume_series}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tt} />
              <Line type="monotone" dataKey="fraud" stroke="#EF4444" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="volume" stroke="#60A5FA" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Fraud probability histogram"
          subtitle="Distribution of scores"
          explanation="Groups transactions by their AI risk score from 0.0 (100% Safe) to 1.0 (100% Fraud). High bars on the left mean most payments are legitimate; bars on the far right show high-risk payments flagged by VanGuard Shield ML."
        >
          <ResponsiveContainer>
            <BarChart data={charts.prob_histogram}>
              <defs>
                <linearGradient id="gHist" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8B5CF6" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="bin" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="count" fill="url(#gHist)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Fraud rate by hour"
          subtitle="24-hour clock"
          explanation="Shows average risk level per hour of the day across all transactions in the last month. Helps you identify high-risk operating hours (like late night 2 AM - 5 AM) when fraud is naturally more frequent."
        >
          <ResponsiveContainer>
            <AreaChart data={charts.hourly_fraud_rate}>
              <defs><linearGradient id="gH" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#06B6D4" stopOpacity={0.6} /><stop offset="1" stopColor="#06B6D4" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="hour" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tt} />
              <Area type="monotone" dataKey="rate" stroke="#06B6D4" fill="url(#gH)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Fraud by weekday"
          subtitle="Legit vs fraud counts"
          explanation="Compares legitimate transactions (blue bars) vs fraudulent transactions (red bars) across each day of the week. Helps admins see if fraud surges on specific days like weekends."
        >
          <ResponsiveContainer>
            <BarChart data={charts.weekday_series}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tt} />
              <Bar dataKey="legit" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
              <Bar dataKey="fraud" stackId="a" fill="#EF4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="OTP verification outcome"
          subtitle="Last 30 days"
          explanation="Breakdown of customer 2-Factor OTP responses: Green = Correct code entered; Cyan = User verified legitimate purchase; Red = Code failed or timed out."
          small
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie data={otpData} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {otpData.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tt} />
            </PieChart>
          </ResponsiveContainer>
          <Legend items={otpData} />
        </ChartCard>

        <ChartCard
          title="Model prediction distribution"
          subtitle="Last 24h"
          explanation="Breakdown of VanGuard Shield AI decisions today: Blue = Approved immediately; Amber = Paused for 2FA OTP verification; Red = Auto-declined high risk."
          small
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie data={modelDist} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {modelDist.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tt} />
            </PieChart>
          </ResponsiveContainer>
          <Legend items={modelDist} />
        </ChartCard>

        <div className="glass rounded-2xl p-5 relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Top fraud scenarios</div>
              <div className="text-xs text-muted-foreground">By occurrence count</div>
            </div>
            
            {/* Interactive Help Tooltip */}
            <div className="group relative inline-flex items-center">
              <button type="button" className="text-muted-foreground hover:text-cyan-400 focus:outline-none transition-colors">
                <HelpCircle className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute right-0 top-full mt-2 hidden w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50">
                <div className="font-semibold text-cyan-300">Top Fraud Scenarios</div>
                <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Lists the most frequent types of fraud detected across your network (e.g. Card Skimming, Large Amount Spikes, High Velocity Attacks) ranked by count.
                </div>
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {topScenarios.map((t) => {
              const maxCnt = Math.max(...topScenarios.map((s) => s.cnt), 1);
              return (
                <li key={t.scenario_name} className="flex items-center gap-3">
                  <span className="w-28 truncate font-mono text-xs text-muted-foreground">{t.scenario_name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-[color:var(--danger)]" style={{ width: `${Math.min(100, (t.cnt / maxCnt) * 100)}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-mono">{t.cnt}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

const tt = { background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 };

function ChartCard({
  title,
  subtitle,
  explanation,
  children,
  small,
}: {
  title: string;
  subtitle: string;
  explanation?: string;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-5 relative">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-white">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>

        {explanation && (
          <div className="group relative inline-flex items-center">
            <button
              type="button"
              className="text-muted-foreground hover:text-cyan-400 focus:outline-none transition-colors"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-2 hidden w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50">
              <div className="font-semibold text-cyan-300">{title}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{explanation}</div>
            </div>
          </div>
        )}
      </div>
      <div className={small ? "h-52" : "h-64"}>{children}</div>
    </div>
  );
}

function Legend({ items }: { items: { name: string; value: number; color: string }[] }) {
  return (
    <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.name} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: i.color }} />
          {i.name} · {i.value}%
        </span>
      ))}
    </div>
  );
}
