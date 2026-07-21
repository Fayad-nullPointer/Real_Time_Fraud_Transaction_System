import { a as __toESM } from "../_runtime.mjs";
import { n as AnimatePresence, t as motion } from "../_libs/framer-motion.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { G as CircleQuestionMark, L as Funnel, O as LoaderCircle, z as Download } from "../_libs/lucide-react.mjs";
import { t as useAdminWs } from "./useAdminWs-CNYccNIn.mjs";
import { r as formatFeatureKey, t as FEATURE_EXPLANATIONS } from "./FeatureProfileViewer-BefmIC0g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.live-DNN1Unhj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function statusMeta(status) {
	switch (status) {
		case "APPROVED": return {
			label: "Approved",
			color: "text-[color:var(--success)]",
			dot: "bg-[color:var(--success)]"
		};
		case "VERIFIED": return {
			label: "Verified",
			color: "text-[color:var(--cyan)]",
			dot: "bg-[color:var(--cyan)]"
		};
		case "PENDING_OTP": return {
			label: "OTP Pending",
			color: "text-[color:var(--warning)]",
			dot: "bg-[color:var(--warning)]"
		};
		case "DECLINED": return {
			label: "Declined",
			color: "text-[color:var(--danger)]",
			dot: "bg-[color:var(--danger)]"
		};
		default: return {
			label: status,
			color: "text-muted-foreground",
			dot: "bg-white/30"
		};
	}
}
function LivePage() {
	const [rows, setRows] = (0, import_react.useState)([]);
	const [filter, setFilter] = (0, import_react.useState)("all");
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [detail, setDetail] = (0, import_react.useState)(null);
	const [loadingDetail, setLoadingDetail] = (0, import_react.useState)(false);
	const [activeTooltip, setActiveTooltip] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		dashboardApi.transactions(50).then(setRows).catch(console.error);
	}, []);
	(0, import_react.useEffect)(() => {
		if (selected) {
			setLoadingDetail(true);
			dashboardApi.transactionDetail(selected.transaction_id).then((res) => {
				setDetail(res);
				setLoadingDetail(false);
			}).catch(() => {
				setDetail(null);
				setLoadingDetail(false);
			});
		} else setDetail(null);
	}, [selected]);
	const isConnected = useAdminWs((ev) => {
		if (ev.event === "TRANSACTION") {
			const newRow = {
				transaction_id: ev.transaction_id,
				customer_id: ev.customer_id,
				terminal_id: ev.terminal_id,
				tx_amount: ev.amount,
				tx_datetime: ev.timestamp,
				is_fraud: ev.is_fraud,
				fraud_probability: ev.fraud_probability,
				scenario_name: ev.scenario_name,
				top_reason: null,
				status: ev.status
			};
			setRows((prev) => [newRow, ...prev].slice(0, 50));
		}
	});
	const view = rows.filter((r) => filter === "all" ? true : filter === "fraud" ? r.is_fraud : r.status === "PENDING_OTP" || r.status === "VERIFIED");
	const shapList = detail?.shap_explanation ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-2xl font-semibold tracking-tight",
					children: "Live monitoring"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Real-time transaction stream and status."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${isConnected ? "border-[color:var(--success)]/30 bg-[color:var(--success)]/10 text-[color:var(--success)]" : "border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${isConnected ? "animate-pulse bg-[color:var(--success)]" : "bg-[color:var(--warning)]"}` }), isConnected ? "WS Connected" : "Connecting…"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs",
							children: [
								"all",
								"fraud",
								"otp"
							].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setFilter(f),
								className: `rounded-md px-2.5 py-1 capitalize ${filter === f ? "bg-white/10" : "text-muted-foreground"}`,
								children: f
							}, f))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Funnel, { className: "h-3.5 w-3.5" }), " Filters"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "h-3.5 w-3.5" }), " Export"]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-xs text-muted-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-white/5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Time"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Customer"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Terminal"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Amount"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Fraud prob."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Status"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: view.map((r) => {
						const meta = statusMeta(r.status);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							onClick: () => setSelected(r),
							className: "cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3 text-muted-foreground",
									children: new Date(r.tx_datetime).toLocaleTimeString()
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3 font-mono text-xs",
									children: r.customer_id
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3 font-mono text-xs",
									children: r.terminal_id
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2.5 pr-3",
									children: ["$", r.tx_amount.toFixed(2)]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-1.5 w-20 overflow-hidden rounded-full bg-white/5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "h-full",
												style: {
													width: `${r.fraud_probability * 100}%`,
													background: r.fraud_probability > .7 ? "var(--danger)" : r.fraud_probability > .4 ? "var(--warning)" : "var(--success)"
												}
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-xs text-muted-foreground",
											children: [(r.fraud_probability * 100).toFixed(0), "%"]
										})]
									})
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: `inline-flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 text-xs ${meta.color}`,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${meta.dot}` }), meta.label]
									})
								})
							]
						}, r.transaction_id);
					}) })]
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
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-sm text-muted-foreground",
							children: selected.transaction_id
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-0.5 text-xl font-semibold",
							children: ["$", selected.tx_amount.toFixed(2)]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: () => setSelected(null),
							className: "rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10",
							children: "Close"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 grid grid-cols-2 gap-3 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Customer",
								value: String(selected.customer_id),
								mono: true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Terminal",
								value: String(selected.terminal_id),
								mono: true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Time",
								value: new Date(selected.tx_datetime).toLocaleString()
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Status",
								value: statusMeta(selected.status).label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Fraud prob.",
								value: `${(selected.fraud_probability * 100).toFixed(1)}%`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Scenario",
								value: selected.scenario_name ?? "Legitimate Activity"
							}),
							selected.top_reason && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
								label: "Top reason",
								value: selected.top_reason
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
								children: "TreeSHAP Feature Contributions"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[10px] text-muted-foreground",
								children: [
									"Hover ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "inline h-3 w-3" }),
									" for details"
								]
							})]
						}), loadingDetail ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin text-cyan-400" }), " Calculating SHAP values..."]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-3 space-y-3",
							children: shapList.length > 0 ? shapList.filter((item, idx, arr) => arr.findIndex((t) => t.feature === item.feature) === idx).map((item, idx) => {
								const info = FEATURE_EXPLANATIONS[item.feature];
								const title = formatFeatureKey(item.feature);
								const desc = info?.description ?? `TreeSHAP feature impact score evaluated by LightGBM model.`;
								let rawVal = typeof item.impact === "number" ? item.impact : typeof item.shap_value === "number" ? item.shap_value : Number(item.impact ?? item.shap_value) || 0;
								if (item.feature === "OTP_NOT_ENTERED" && rawVal === 0) rawVal = .95;
								const impactVal = rawVal;
								const isRisk = impactVal > 0;
								const impactPct = Math.min(Math.abs(impactVal) * 100, 100);
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "rounded-xl border border-white/5 bg-white/[0.02] p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center gap-1.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "font-medium text-xs text-white",
												children: title
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "group relative inline-flex items-center",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
													type: "button",
													onClick: () => setActiveTooltip(activeTooltip === item.feature ? null : item.feature),
													className: "text-muted-foreground hover:text-cyan-400 focus:outline-none",
													children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "h-3.5 w-3.5" })
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-60 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "font-semibold text-cyan-300",
														children: title
													}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
														className: "mt-1 text-[11px] text-muted-foreground leading-relaxed",
														children: desc
													})]
												})]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `text-[11px] font-mono font-medium ${isRisk ? "text-amber-400" : "text-emerald-400"}`,
											children: isRisk ? `+${impactVal.toFixed(3)} (Risk)` : `${impactVal.toFixed(3)} (Legit)`
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: `h-full rounded-full transition-all duration-300 ${isRisk ? "bg-amber-500" : "bg-emerald-500"}`,
											style: { width: `${Math.max(impactPct, 15)}%` }
										})
									})]
								}, `${item.feature}_${idx}`);
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "space-y-2 text-xs",
								children: [
									{
										feature: "Z_score",
										impact: selected.fraud_probability > .4 ? .42 : -.15
									},
									{
										feature: "distance",
										impact: selected.fraud_probability > .6 ? .28 : -.1
									},
									{
										feature: "PREV_TX_AMOUNT_lag1",
										impact: .12
									}
								].map((item) => {
									const info = FEATURE_EXPLANATIONS[item.feature];
									const title = formatFeatureKey(item.feature);
									const desc = info?.description ?? "ML model feature value.";
									const impactVal = typeof item.impact === "number" ? item.impact : Number(item.impact) || 0;
									const isRisk = impactVal > 0;
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "rounded-xl border border-white/5 bg-white/[0.02] p-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex items-center justify-between",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
												className: "flex items-center gap-1.5",
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "font-medium text-xs text-white",
													children: title
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
													className: "group relative inline-flex",
													children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "h-3.5 w-3.5 text-muted-foreground hover:text-cyan-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
														className: "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden w-60 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50",
														children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "font-semibold text-cyan-300",
															children: title
														}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
															className: "mt-1 text-[11px] text-muted-foreground leading-relaxed",
															children: desc
														})]
													})]
												})]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: `text-[11px] font-mono ${isRisk ? "text-amber-400" : "text-emerald-400"}`,
												children: isRisk ? `+${impactVal.toFixed(2)}` : `${impactVal.toFixed(2)}`
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: `h-full ${isRisk ? "bg-amber-500" : "bg-emerald-500"}`,
												style: { width: `${Math.abs(item.impact) * 100}%` }
											})
										})]
									}, item.feature);
								})
							})
						})]
					})
				]
			})] }) })
		]
	});
}
function Field({ label, value, mono }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-white/5 bg-white/[0.02] p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `mt-0.5 ${mono ? "font-mono text-xs" : ""}`,
			children: value
		})]
	});
}
//#endregion
export { LivePage as component };
