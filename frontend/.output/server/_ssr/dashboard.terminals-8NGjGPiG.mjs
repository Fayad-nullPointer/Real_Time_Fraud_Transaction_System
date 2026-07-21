import { a as __toESM } from "../_runtime.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { t as GoogleTerminalMap } from "./GoogleTerminalMap-wSxea593.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.terminals-8NGjGPiG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function TerminalsPage() {
	const [terminals, setTerminals] = (0, import_react.useState)([]);
	const [selected, setSelected] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		dashboardApi.terminalStats().then((data) => {
			setTerminals(data);
			if (data.length > 0) setSelected(data[0]);
		}).catch(console.error);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-2xl font-semibold tracking-tight",
			children: "Terminals"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted-foreground",
			children: "Fraud rates and geographic distribution across the network."
		})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-4 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "col-span-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoogleTerminalMap, {
					terminals: terminals.map((t) => ({
						terminal_id: t.terminal_id,
						terminal_name: t.terminal_name,
						latitude: t.latitude,
						longitude: t.longitude,
						fraud_rate: t.fraud_rate_7d,
						risk_score: t.risk_score
					})),
					selectedId: selected?.terminal_id ?? null,
					onSelect: (t) => {
						const found = terminals.find((x) => x.terminal_id === t.terminal_id);
						if (found) setSelected(found);
					},
					height: "520px"
				})
			}), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted-foreground",
						children: "Terminal"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-0.5 font-mono text-lg",
						children: ["TRM-", selected.terminal_id]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-sm text-muted-foreground",
						children: selected.terminal_name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid grid-cols-3 gap-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "3-day",
								value: `${(selected.fraud_rate_3d * 100).toFixed(1)}%`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "7-day",
								value: `${(selected.fraud_rate_7d * 100).toFixed(1)}%`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "28-day",
								value: `${(selected.fraud_rate_28d * 100).toFixed(1)}%`
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 grid grid-cols-2 gap-2 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Total txns",
								value: selected.total_txns.toLocaleString()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Fraud count",
								value: String(selected.fraud_count)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Nearby incidents",
								value: String(selected.nearby_incidents)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Risk score",
								value: String(selected.risk_score)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Lat",
								value: selected.latitude.toFixed(4)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
								label: "Lng",
								value: selected.longitude.toFixed(4)
							})
						]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass flex items-center justify-center rounded-2xl p-5 text-sm text-muted-foreground",
				children: terminals.length === 0 ? "Loading terminals…" : "Select a terminal"
			})]
		})]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-white/5 bg-white/[0.02] p-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] uppercase tracking-wider text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 font-medium",
			children: value
		})]
	});
}
//#endregion
export { TerminalsPage as component };
