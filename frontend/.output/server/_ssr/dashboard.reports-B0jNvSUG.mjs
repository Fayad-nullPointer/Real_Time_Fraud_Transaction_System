import { a as __toESM } from "../_runtime.mjs";
import { n as AnimatePresence, t as motion } from "../_libs/framer-motion.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { R as FileText, _ as Search, c as TriangleAlert, m as ShieldAlert, o as User, q as CircleCheckBig, w as MapPin } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.reports-B0jNvSUG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ReportsPage() {
	const [reports, setReports] = (0, import_react.useState)([]);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [loading, setLoading] = (0, import_react.useState)(false);
	const fetchReports = () => {
		setLoading(true);
		dashboardApi.reports().then((res) => {
			setReports(res);
			setLoading(false);
		}).catch((err) => {
			console.error(err);
			setLoading(false);
		});
	};
	(0, import_react.useEffect)(() => {
		fetchReports();
		const interval = setInterval(fetchReports, 1e4);
		return () => clearInterval(interval);
	}, []);
	const filtered = reports.filter((r) => {
		if (!(filter === "all" ? true : filter === "reported" ? r.status === "REPORTED_FRAUD" : r.status === "DECLINED")) return false;
		if (!q) return true;
		const query = q.toLowerCase();
		return r.transaction_id.toLowerCase().includes(query) || String(r.customer_id).includes(query) || String(r.terminal_id).includes(query) || r.scenario.toLowerCase().includes(query) || r.customer_statement.toLowerCase().includes(query);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "text-2xl font-semibold tracking-tight flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileText, { className: "h-6 w-6 text-rose-400" }), " Customer Reports & Audit Claims"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Customer-submitted unauthorized transaction claims, card skimming reports, and 2FA OTP audit logs."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs",
						children: [
							{
								label: "All Claims",
								val: "all"
							},
							{
								label: "Reported Fraud",
								val: "reported"
							},
							{
								label: "OTP Declines",
								val: "declined"
							}
						].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setFilter(f.val),
							className: `rounded-md px-2.5 py-1 capitalize transition-colors ${filter === f.val ? "bg-white/10 text-white font-medium" : "text-muted-foreground hover:text-white"}`,
							children: f.label
						}, f.val))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3.5 w-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "Search TX, customer ID, scenario…",
							className: "w-56 bg-transparent outline-none placeholder:text-muted-foreground"
						})]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-1 gap-4 lg:grid-cols-2",
				children: filtered.length > 0 ? filtered.map((r) => {
					const isReported = r.status === "REPORTED_FRAUD";
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						onClick: () => setSelected(r),
						className: "glass cursor-pointer rounded-2xl p-5 border border-white/5 hover:border-white/20 transition-all hover:bg-white/[0.02] flex flex-col justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: `inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${isReported ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`,
									children: [isReported ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-3 w-3" }), isReported ? "UNAUTHORIZED CLAIM" : "OTP AUTO-DECLINED"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "mt-2 text-base font-semibold text-white",
									children: r.scenario
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "text-right",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-lg font-bold text-white",
										children: ["$", r.amount.toFixed(2)]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] text-muted-foreground",
										children: new Date(r.timestamp).toLocaleString()
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "h-3.5 w-3.5 text-cyan-400" }),
										" Customer ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-white",
											children: ["#", r.customer_id]
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-3.5 w-3.5 text-amber-400" }),
										" Terminal ",
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-white",
											children: ["#", r.terminal_id]
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 rounded-xl border border-white/5 bg-black/40 p-3 text-xs text-slate-300 leading-relaxed italic",
								children: [
									"\"",
									r.customer_statement,
									"\""
								]
							})
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-muted-foreground text-[11px]",
								children: [
									"TX: ",
									r.transaction_id.slice(0, 16),
									"…"
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-cyan-400 hover:underline font-medium",
								children: "Investigate Claim →"
							})]
						})]
					}, r.transaction_id);
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "glass col-span-full rounded-2xl p-12 text-center text-sm text-muted-foreground",
					children: "No customer reports found matching the specified criteria."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, { children: selected && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
				initial: { opacity: 0 },
				animate: { opacity: 1 },
				exit: { opacity: 0 },
				className: "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
				onClick: () => setSelected(null)
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.aside, {
				initial: { x: 480 },
				animate: { x: 0 },
				exit: { x: 480 },
				transition: {
					type: "spring",
					stiffness: 240,
					damping: 28
				},
				className: "fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[color:var(--background)]/95 p-6 backdrop-blur-xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-b border-white/10 pb-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted-foreground uppercase font-semibold",
						children: "Incident Audit Detail"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-0.5 text-xl font-bold text-white",
						children: ["$", selected.amount.toFixed(2)]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => setSelected(null),
						className: "rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs hover:bg-white/10",
						children: "Close"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-5 space-y-4 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground font-medium uppercase tracking-wider",
								children: "Report Statement"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-slate-200 leading-relaxed italic",
								children: [
									"\"",
									selected.customer_statement,
									"\""
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-3 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-white/5 bg-white/[0.02] p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-muted-foreground",
										children: "Transaction ID"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-white font-medium mt-0.5",
										children: selected.transaction_id
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-white/5 bg-white/[0.02] p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-muted-foreground",
										children: "Status"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-semibold text-rose-400 mt-0.5",
										children: selected.status
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-white/5 bg-white/[0.02] p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-muted-foreground",
										children: "Customer ID"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-mono text-white font-medium mt-0.5",
										children: ["#", selected.customer_id]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-white/5 bg-white/[0.02] p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-muted-foreground",
										children: "Terminal ID"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-mono text-white font-medium mt-0.5",
										children: ["#", selected.terminal_id]
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs font-semibold text-white uppercase tracking-wider",
									children: "Analyst Decision Actions"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										toast.success(`Marked TX #${selected.transaction_id.slice(0, 8)} as confirmed fraud incident.`);
										setSelected(null);
									},
									className: "w-full rounded-xl bg-rose-500/20 border border-rose-500/30 p-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30 transition-colors flex items-center justify-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "h-4 w-4" }), " Confirm Fraud Incident & Block Card"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: () => {
										toast.success(`Marked TX #${selected.transaction_id.slice(0, 8)} as false positive.`);
										setSelected(null);
									},
									className: "w-full rounded-xl bg-emerald-500/20 border border-emerald-500/30 p-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheckBig, { className: "h-4 w-4" }), " Resolve as Legitimate Customer Activity"]
								})
							]
						})
					]
				})]
			})] }) })
		]
	});
}
//#endregion
export { ReportsPage as component };
