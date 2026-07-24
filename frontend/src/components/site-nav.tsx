import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Home, CreditCard, User, ShieldAlert } from "lucide-react";

export function SiteNav() {
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/vanguard-logo.png" alt="VanGuard Shield" className="h-8 w-auto object-contain" />
            <span className="font-semibold tracking-tight hidden sm:inline">VanGuard Shield</span>
            <span className="ml-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">AI</span>
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

        <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <Link to="/" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition">
            <Home className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Home</span>
          </Link>
          <Link to="/pay" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition">
            <CreditCard className="h-3.5 w-3.5 text-cyan-300" />
            <span>Pay</span>
          </Link>
          <Link to="/profile" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition">
            <User className="h-3.5 w-3.5" />
            <span>Profile</span>
          </Link>
          <Link to="/dashboard" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-white/5 hover:text-white transition">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium hover:bg-white/10 transition"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-[image:var(--gradient-primary)] px-3 py-1.5 text-xs font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 transition"
          >
            Register
          </Link>
        </div>
      </div>
    </header>
  );
}
