import { a as __toESM } from "../_runtime.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { A as Layers, J as ChevronRight, X as ChevronDown, _ as Search, d as Terminal, v as RefreshCw } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.logs-BQmZF-sY.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LogsPage() {
	const [logs, setLogs] = (0, import_react.useState)([]);
	const [levelFilter, setLevelFilter] = (0, import_react.useState)("");
	const [q, setQ] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [expandedIndex, setExpandedIndex] = (0, import_react.useState)(null);
	const fetchLogs = () => {
		setLoading(true);
		dashboardApi.logs(200, levelFilter).then((data) => {
			setLogs(data);
			setLoading(false);
		}).catch((err) => {
			console.error(err);
			setLoading(false);
		});
	};
	(0, import_react.useEffect)(() => {
		fetchLogs();
		const interval = setInterval(fetchLogs, 4e3);
		return () => clearInterval(interval);
	}, [levelFilter]);
	const filtered = logs.filter((l) => {
		if (!q) return true;
		const searchStr = q.toLowerCase();
		return l.message && l.message.toLowerCase().includes(searchStr) || l.name && l.name.toLowerCase().includes(searchStr) || l.transaction_id && String(l.transaction_id).toLowerCase().includes(searchStr) || l.event_type && l.event_type.toLowerCase().includes(searchStr);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "text-2xl font-semibold tracking-tight flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Terminal, { className: "h-6 w-6 text-cyan-400" }), " Kafka Event Logs"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Real-time event stream from Kafka topics, ML inference pipeline, and microservices."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs",
						children: [
							{
								label: "All Levels",
								val: ""
							},
							{
								label: "INFO",
								val: "INFO"
							},
							{
								label: "WARN",
								val: "WARNING"
							},
							{
								label: "ERROR",
								val: "ERROR"
							}
						].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setLevelFilter(f.val),
							className: `rounded-md px-2.5 py-1 capitalize transition-colors ${levelFilter === f.val ? "bg-white/10 text-white font-medium" : "text-muted-foreground hover:text-white"}`,
							children: f.label
						}, f.val))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3.5 w-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "Filter by TX, topic or keyword…",
							className: "w-56 bg-transparent outline-none placeholder:text-muted-foreground"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: fetchLogs,
						disabled: loading,
						className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-white transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: `h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}` }), " Refresh"]
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "glass rounded-2xl p-4 font-mono text-xs overflow-hidden border border-white/10",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-white/10 pb-3 mb-3 text-muted-foreground text-[11px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2 w-2 rounded-full bg-emerald-500 animate-pulse" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Kafka Topic: ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-white font-semibold",
						children: "fraud.transactions.v1"
					})] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [filtered.length, " events retrieved"] })]
			}), filtered.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-1.5 max-h-[640px] overflow-y-auto pr-1",
				children: filtered.map((entry, idx) => {
					const isExpanded = expandedIndex === idx;
					const isError = entry.level?.toUpperCase() === "ERROR";
					const isWarn = entry.level?.toUpperCase() === "WARN" || entry.level?.toUpperCase() === "WARNING";
					const levelBadgeColor = isError ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : isWarn ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-xl border border-white/5 bg-black/40 p-2.5 transition-colors hover:border-white/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							onClick: () => setExpandedIndex(isExpanded ? null : idx),
							className: "flex items-start justify-between cursor-pointer gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 min-w-0",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										className: "text-muted-foreground hover:text-white",
										children: isExpanded ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-3.5 w-3.5" })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground text-[10px] shrink-0",
										children: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : "—"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: `rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase shrink-0 ${levelBadgeColor}`,
										children: entry.level ?? "INFO"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-cyan-300 text-[11px] shrink-0 font-medium",
										children: entry.name ?? "sentinel"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-slate-200 truncate leading-relaxed",
										children: entry.message
									})
								]
							}), entry.transaction_id && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "shrink-0 rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-muted-foreground font-mono",
								children: ["TX: ", entry.transaction_id]
							})]
						}), isExpanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 rounded-lg border border-white/10 bg-slate-950 p-3 text-[11px] text-slate-300 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-1.5 text-xs font-semibold text-cyan-400 border-b border-white/10 pb-1.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "h-3.5 w-3.5" }), " Kafka Event Payload & Metadata"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "overflow-x-auto text-[10px] leading-relaxed text-emerald-300",
								children: JSON.stringify(entry, null, 2)
							})]
						})]
					}, idx);
				})
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "py-12 text-center text-sm text-muted-foreground",
				children: "No Kafka events found matching the specified log level or search query."
			})]
		})]
	});
}
//#endregion
export { LogsPage as component };
