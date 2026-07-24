import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Home, CreditCard, User, ShieldAlert, LogOut } from "lucide-react";
import { getCustomer, clearCustomerToken } from "@/lib/api";
import { toast } from "sonner";

export function Navbar() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const customer = getCustomer();

  const handleBack = () => {
    if (typeof window !== "undefined") {
      window.history.back();
    }
  };

  const handleForward = () => {
    if (typeof window !== "undefined") {
      window.history.forward();
    }
  };

  const logout = () => {
    clearCustomerToken();
    try {
      localStorage.removeItem("sentinel:cardNumber");
      localStorage.removeItem("sentinel:profile");
    } catch {}
    toast.success("Signed out successfully");
    navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand Logo + History Arrows */}
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <img src="/vanguard-logo.png" alt="VanGuard Shield" className="h-7 w-auto object-contain" />
            <span className="font-bold tracking-tight text-white hidden sm:inline">VanGuard Shield</span>
          </Link>

          {/* Browser Navigation Arrows */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={handleBack}
              title="Go Back"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleForward}
              title="Go Forward"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Center: Easy Navigation Tabs */}
        <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              currentPath === "/"
                ? "bg-[image:var(--gradient-primary)] text-white shadow-md"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Home</span>
          </Link>

          <Link
            to="/pay"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              currentPath === "/pay"
                ? "bg-[image:var(--gradient-primary)] text-white shadow-md"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 text-cyan-300" />
            <span>Pay</span>
          </Link>

          <Link
            to="/profile"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              currentPath === "/profile"
                ? "bg-[image:var(--gradient-primary)] text-white shadow-md"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Profile</span>
          </Link>

          <Link
            to="/dashboard"
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              currentPath.startsWith("/dashboard")
                ? "bg-[image:var(--gradient-primary)] text-white shadow-md"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </nav>

        {/* Right: Sign Out / Account */}
        <div className="flex items-center gap-2">
          {customer ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
