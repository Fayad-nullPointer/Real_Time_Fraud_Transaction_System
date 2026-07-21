import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Activity, LineChart, Users, MapPin, Bell,
  Server, ShieldCheck, Search, Settings, ChevronLeft, ChevronRight,
  Terminal, FileText, LogOut
} from "lucide-react";
import { useEffect, useState } from "react";
import { getAdminToken, clearAdminToken } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const nav: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/live", label: "Live Monitoring", icon: Activity },
  { to: "/dashboard/analytics", label: "Analytics", icon: LineChart },
  { to: "/dashboard/customers", label: "Customers", icon: Users },
  { to: "/dashboard/terminals", label: "Terminals", icon: MapPin },
  { to: "/dashboard/alerts", label: "Alerts", icon: Bell },
  { to: "/dashboard/logs", label: "Kafka Event Logs", icon: Terminal },
  { to: "/dashboard/reports", label: "Customer Reports", icon: FileText },
  { to: "/dashboard/system", label: "System", icon: Server },
];

function DashboardLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      toast.error("Please sign in as Admin to access the dashboard.");
      setIsAuthenticated(false);
      navigate({ to: "/login" });
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate, pathname]);

  const handleAdminLogout = () => {
    clearAdminToken();
    toast.success("Admin session ended.");
    navigate({ to: "/login" });
  };

  if (isAuthenticated === null || isAuthenticated === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-[color:var(--background)]">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          Verifying Admin Session…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen w-full">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-white/5 bg-[color:var(--sidebar)]/70 backdrop-blur-xl transition-[width] md:block ${collapsed ? "w-16" : "w-64"}`}
        >
          <div className="flex h-16 items-center gap-2 border-b border-white/5 px-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-primary)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            {!collapsed && <div className="font-semibold">Sentinel</div>}
            {!collapsed && <span className="ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Analyst</span>}
          </div>
          <nav className="flex flex-col gap-1 p-3">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to as "/dashboard"}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />}
                </Link>
              );
            })}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/5 p-3">
            <button
              suppressHydrationWarning
              onClick={() => setCollapsed((c) => !c)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground hover:bg-white/10"
            >
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <><ChevronLeft className="h-3.5 w-3.5" /> Collapse</>}
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/5 bg-[color:var(--background)]/70 px-6 backdrop-blur-xl">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm md:max-w-md">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input suppressHydrationWarning placeholder="Search transactions, customers, terminals…" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
              <kbd className="rounded border border-white/10 px-1 text-[10px] text-muted-foreground">⌘K</kbd>
            </div>
            <button suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-foreground">
              <Bell className="h-4 w-4" />
            </button>
            <button suppressHydrationWarning className="rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-foreground">
              <Settings className="h-4 w-4" />
            </button>
            <div className="ml-1 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-medium text-white">
                AD
              </div>
              <button
                type="button"
                onClick={handleAdminLogout}
                title="Log Out Admin"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>
          <main className="min-w-0 flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
