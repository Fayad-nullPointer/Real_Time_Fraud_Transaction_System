import { a as __toESM } from "../_runtime.mjs";
import { a as getAdminToken, n as clearAdminToken } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { f as Outlet, g as Link, l as useRouterState, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { E as LogOut, J as ChevronRight, R as FileText, Y as ChevronLeft, Z as ChartLine, _ as Search, a as Users, d as Terminal, et as Bell, g as Server, h as Settings, it as Activity, k as LayoutDashboard, p as ShieldCheck, w as MapPin } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard-DC-aXliZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var nav = [
	{
		to: "/dashboard",
		label: "Overview",
		icon: LayoutDashboard,
		exact: true
	},
	{
		to: "/dashboard/live",
		label: "Live Monitoring",
		icon: Activity
	},
	{
		to: "/dashboard/analytics",
		label: "Analytics",
		icon: ChartLine
	},
	{
		to: "/dashboard/customers",
		label: "Customers",
		icon: Users
	},
	{
		to: "/dashboard/terminals",
		label: "Terminals",
		icon: MapPin
	},
	{
		to: "/dashboard/alerts",
		label: "Alerts",
		icon: Bell
	},
	{
		to: "/dashboard/logs",
		label: "Kafka Event Logs",
		icon: Terminal
	},
	{
		to: "/dashboard/reports",
		label: "Customer Reports",
		icon: FileText
	},
	{
		to: "/dashboard/system",
		label: "System",
		icon: Server
	}
];
function DashboardLayout() {
	const navigate = useNavigate();
	const [collapsed, setCollapsed] = (0, import_react.useState)(false);
	const [isAuthenticated, setIsAuthenticated] = (0, import_react.useState)(null);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	(0, import_react.useEffect)(() => {
		if (!getAdminToken()) {
			toast.error("Please sign in as Admin to access the dashboard.");
			setIsAuthenticated(false);
			navigate({ to: "/login" });
		} else setIsAuthenticated(true);
	}, [navigate, pathname]);
	const handleAdminLogout = () => {
		clearAdminToken();
		toast.success("Admin session ended.");
		navigate({ to: "/login" });
	};
	if (isAuthenticated === null || isAuthenticated === false) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-screen items-center justify-center bg-[color:var(--background)]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" }), "Verifying Admin Session…"]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "min-h-screen",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-screen w-full",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: `sticky top-0 hidden h-screen shrink-0 border-r border-white/5 bg-[color:var(--sidebar)]/70 backdrop-blur-xl transition-[width] md:block ${collapsed ? "w-16" : "w-64"}`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex h-16 items-center gap-2 border-b border-white/5 px-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-primary)]",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4 text-white" })
							}),
							!collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "font-semibold",
								children: "Sentinel"
							}),
							!collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-auto rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground",
								children: "Analyst"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-col gap-1 p-3",
						children: nav.map((item) => {
							const active = item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/");
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: item.to,
								className: `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`,
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(item.icon, { className: "h-4 w-4 shrink-0" }),
									!collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }),
									!collapsed && active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "ml-auto h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" })
								]
							}, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute bottom-0 left-0 right-0 border-t border-white/5 p-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							suppressHydrationWarning: true,
							onClick: () => setCollapsed((c) => !c),
							className: "flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground hover:bg-white/10",
							children: collapsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-3.5 w-3.5" }), " Collapse"] })
						})
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/5 bg-[color:var(--background)]/70 px-6 backdrop-blur-xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm md:max-w-md",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3.5 w-3.5 text-muted-foreground" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									suppressHydrationWarning: true,
									placeholder: "Search transactions, customers, terminals…",
									className: "w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("kbd", {
									className: "rounded border border-white/10 px-1 text-[10px] text-muted-foreground",
									children: "⌘K"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							suppressHydrationWarning: true,
							className: "rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							suppressHydrationWarning: true,
							className: "rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground hover:text-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "ml-1 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-8 w-8 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-xs font-medium text-white",
								children: "AD"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: handleAdminLogout,
								title: "Log Out Admin",
								className: "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 transition-colors",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: "Logout"
								})]
							})]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "min-w-0 flex-1 p-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {})
				})]
			})]
		})
	});
}
//#endregion
export { DashboardLayout as component };
