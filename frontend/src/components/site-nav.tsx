import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[color:var(--background)]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">Sentinel</span>
          <span className="ml-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">AI</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <Link to="/dashboard/analytics" className="hover:text-foreground">Analytics</Link>
          <a href="#docs" className="hover:text-foreground">Documentation</a>
          <a href="#about" className="hover:text-foreground">About</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm hover:bg-white/10"
          >
            Login
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-[image:var(--gradient-primary)] px-3.5 py-1.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
