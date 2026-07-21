import { a as __toESM } from "../_runtime.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { $ as Boxes, F as GitBranch, I as Gauge, P as HardDrive, S as MemoryStick, U as Cpu, V as Database, a as Users, i as Wifi, u as Timer } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.system-Bn-_tWdx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var SERVICES = [
	{
		name: "Ingestion API",
		uptime: 99.99
	},
	{
		name: "Feature service",
		uptime: 99.98
	},
	{
		name: "Inference service",
		uptime: 99.96
	},
	{
		name: "OTP / Twilio Verify",
		uptime: 99.9
	},
	{
		name: "Analytics warehouse",
		uptime: 99.94
	}
];
function statusTone(s) {
	if (s === "healthy" || s === "ok" || s === "operational") return "success";
	if (s === "degraded" || s === "slow") return "warning";
	return "danger";
}
function SystemPage() {
	const [health, setHealth] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const fetch = () => dashboardApi.system().then(setHealth).catch(console.error);
		fetch();
		const iv = setInterval(fetch, 1e4);
		return () => clearInterval(iv);
	}, []);
	if (health === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "System"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "Operational metrics across the fraud-detection stack."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid grid-cols-2 gap-3 md:grid-cols-4",
			children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "glass h-24 animate-pulse rounded-2xl" }, i))
		})]
	});
	const getStatusStr = (val) => {
		if (typeof val === "string") return val;
		if (val && typeof val === "object" && "status" in val) return String(val.status);
		return "running";
	};
	const apiStatus = getStatusStr(health.fastapi);
	const dbStatus = getStatusStr(health.postgres);
	getStatusStr(health.redis);
	const apiTone = statusTone(apiStatus);
	const dbTone = statusTone(dbStatus);
	const mlTone = statusTone(health.ml_model.status);
	const metrics = [
		{
			label: "ML Inference",
			value: `${health.ml_model.inference_ms.toFixed(1)} ms`,
			Icon: Timer,
			tone: mlTone
		},
		{
			label: "Model version",
			value: health.ml_model.version,
			Icon: GitBranch,
			tone: "purple"
		},
		{
			label: "FastAPI",
			value: apiStatus,
			Icon: Gauge,
			tone: apiTone
		},
		{
			label: "PostgreSQL",
			value: dbStatus,
			Icon: Database,
			tone: dbTone
		},
		{
			label: "Redis cache hit",
			value: `${(health.redis.cache_hit_rate * 100).toFixed(1)}%`,
			Icon: Boxes,
			tone: "cyan"
		},
		{
			label: "WS clients",
			value: String(health.websocket.connected_clients),
			Icon: Wifi,
			tone: "primary"
		},
		{
			label: "CPU",
			value: `${health.resources.cpu.toFixed(1)}%`,
			Icon: Cpu,
			tone: health.resources.cpu > 80 ? "danger" : health.resources.cpu > 60 ? "warning" : "success"
		},
		{
			label: "RAM",
			value: `${health.resources.ram.toFixed(1)}%`,
			Icon: MemoryStick,
			tone: health.resources.ram > 85 ? "danger" : health.resources.ram > 65 ? "warning" : "success"
		},
		{
			label: "Disk",
			value: `${health.resources.disk.toFixed(1)}%`,
			Icon: HardDrive,
			tone: health.resources.disk > 90 ? "danger" : health.resources.disk > 70 ? "warning" : "success"
		},
		{
			label: "Active users",
			value: String(health.websocket.connected_clients),
			Icon: Users,
			tone: "cyan"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-semibold tracking-tight",
				children: "System"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Operational metrics across the fraud-detection stack."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5",
				children: metrics.map((m) => {
					const color = m.tone === "danger" ? "var(--danger)" : m.tone === "warning" ? "var(--warning)" : m.tone === "success" ? "var(--success)" : m.tone === "purple" ? "var(--purple)" : m.tone === "primary" ? "var(--primary)" : "var(--cyan)";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass rounded-2xl p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 text-xs text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(m.Icon, {
								className: "h-4 w-4",
								style: { color }
							}), m.label]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1.5 text-xl font-semibold",
							children: m.value
						})]
					}, m.label);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-medium",
					children: "Service uptime · last 30 days"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-3",
					children: SERVICES.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-1 flex items-center justify-between text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: s.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-[color:var(--success)]",
							children: [s.uptime.toFixed(2), "%"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid gap-0.5",
						style: { gridTemplateColumns: "repeat(30, minmax(0, 1fr))" },
						children: Array.from({ length: 30 }).map((_, i) => {
							return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-6 rounded-sm ${Math.random() > .97 ? "bg-[color:var(--warning)]/70" : "bg-[color:var(--success)]/50"}` }, i);
						})
					})] }, s.name))
				})]
			})
		]
	});
}
//#endregion
export { SystemPage as component };
