import { a as __toESM } from "../_runtime.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { c as TriangleAlert, q as CircleCheckBig } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.alerts-B5hpGNWx.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AlertsPage() {
	const [alertList, setAlertList] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		const fetch = () => dashboardApi.alerts().then(setAlertList).catch(console.error);
		fetch();
		const iv = setInterval(fetch, 3e4);
		return () => clearInterval(iv);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "Alerts"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "All active fraud alerts, prioritised by severity."
		})] }), alertList.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-[color:var(--success)]/5 py-16 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "h-8 w-8 text-[color:var(--success)]" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-sm font-medium",
					children: "No active alerts — system is healthy"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "text-xs text-muted-foreground",
					children: "Alerts refresh automatically every 30 seconds."
				})
			]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "grid grid-cols-1 gap-3 md:grid-cols-2",
			children: alertList.map((a, i) => {
				const tone = a.severity === "danger" ? "text-[color:var(--danger)]" : a.severity === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--cyan)]";
				const bg = a.severity === "danger" ? "bg-[color:var(--danger)]/10" : a.severity === "warning" ? "bg-[color:var(--warning)]/10" : "bg-[color:var(--cyan)]/10";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.li, {
					initial: {
						opacity: 0,
						y: 6
					},
					animate: {
						opacity: 1,
						y: 0
					},
					transition: { delay: i * .02 },
					className: `flex items-start gap-3 rounded-2xl border border-white/5 p-4 ${bg}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: `mt-0.5 h-4 w-4 ${tone}` }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm",
								children: a.message
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-0.5 text-xs text-muted-foreground",
								children: a.time
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							className: "rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10",
							children: "Acknowledge"
						})
					]
				}, a.id);
			})
		})]
	});
}
//#endregion
export { AlertsPage as component };
