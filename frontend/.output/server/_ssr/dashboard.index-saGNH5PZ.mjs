import { a as __toESM } from "../_runtime.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { B as DollarSign, G as CircleQuestionMark, a as Users, c as TriangleAlert, it as Activity, l as TrendingUp, m as ShieldAlert, rt as ArrowDownRight, s as UserPlus, tt as ArrowUpRight, w as MapPin } from "../_libs/lucide-react.mjs";
import { a as YAxis, l as CartesianGrid, m as Tooltip, o as XAxis, p as ResponsiveContainer, r as BarChart, s as Area, t as AreaChart, u as Bar } from "../_libs/recharts+[...].mjs";
import { t as useAdminWs } from "./useAdminWs-CNYccNIn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.index-saGNH5PZ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var WEEKDAY_FALLBACK = [
	{
		day: "Mon",
		fraud: 42
	},
	{
		day: "Tue",
		fraud: 38
	},
	{
		day: "Wed",
		fraud: 55
	},
	{
		day: "Thu",
		fraud: 61
	},
	{
		day: "Fri",
		fraud: 79
	},
	{
		day: "Sat",
		fraud: 34
	},
	{
		day: "Sun",
		fraud: 28
	}
];
function OverviewPage() {
	const [metrics, setMetrics] = (0, import_react.useState)(null);
	const [recentTx, setRecentTx] = (0, import_react.useState)([]);
	const [alerts, setAlerts] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => {
		(async () => {
			try {
				const [m, tx] = await Promise.all([dashboardApi.metrics(), dashboardApi.transactions(12)]);
				setMetrics(m);
				setRecentTx(tx);
			} catch (err) {
				console.error("Dashboard fetch error:", err);
			}
		})();
		(async () => {
			try {
				setAlerts(await dashboardApi.alerts());
			} catch (_) {}
		})();
	}, []);
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
			setRecentTx((prev) => [newRow, ...prev].slice(0, 12));
		}
	});
	const volumeData = metrics?.hourly.map((h) => ({
		hour: `${h.hour}:00`,
		volume: h.tx_count,
		fraud: h.fraud_count
	})) ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-semibold tracking-tight",
				children: "Overview"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Real-time snapshot of the payments network."
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Total transactions",
						value: metrics?.total_transactions?.toLocaleString() ?? "—",
						delta: "+3.4%",
						up: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Fraudulent transactions",
						value: metrics?.fraud_detected?.toLocaleString() ?? "—",
						delta: "+4.2%",
						up: true,
						tone: "danger",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Fraud rate",
						value: metrics != null ? `${(metrics.fraud_rate * 100).toFixed(2)}%` : "—",
						delta: "-0.2%",
						up: false,
						tone: "warning",
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Active customers",
						value: metrics?.active_customers?.toLocaleString() ?? "—",
						delta: "+1.1%",
						up: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Active terminals",
						value: metrics?.active_terminals?.toString() ?? "—",
						delta: "0",
						up: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "False positives corrected",
						value: metrics?.false_positives_corrected?.toLocaleString() ?? "—",
						delta: "+8.6%",
						up: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserPlus, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Transaction volume",
						value: metrics != null ? metrics.transaction_volume >= 1e6 ? `$${(metrics.transaction_volume / 1e6).toFixed(2)}M` : metrics.transaction_volume >= 1e3 ? `$${(metrics.transaction_volume / 1e3).toFixed(2)}K` : `$${metrics.transaction_volume.toFixed(2)}` : "—",
						delta: "+2.7%",
						up: true,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kpi, {
						label: "Confirmed fraud",
						value: metrics?.confirmed_fraud?.toLocaleString() ?? "—",
						delta: "-0.4%",
						up: false,
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DollarSign, { className: "h-4 w-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 lg:grid-cols-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-5 lg:col-span-2 relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-medium text-white",
								children: "Transaction volume · 24h"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground",
								children: "Volume and fraud incidents by hour"
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "group relative inline-flex items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "text-muted-foreground hover:text-cyan-400 focus:outline-none transition-colors",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "h-4 w-4" })
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "pointer-events-none absolute left-0 top-full mt-2 hidden w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-semibold text-cyan-300",
										children: "Transaction Volume (24h)"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-[11px] text-muted-foreground leading-relaxed",
										children: "Live operational stream showing total payment traffic (blue area) vs flagged fraud attempts (red area) for every hour in the last 24 hours."
									})]
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1 text-xs text-[color:var(--success)]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${isConnected ? "animate-pulse bg-[color:var(--success)]" : "bg-[color:var(--warning)]"}` }), isConnected ? "Live" : "Connecting…"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-72",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
							data: volumeData,
							margin: {
								top: 8,
								right: 8,
								left: -20,
								bottom: 0
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
									id: "gVol",
									x1: "0",
									x2: "0",
									y1: "0",
									y2: "1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "0%",
										stopColor: "#2563EB",
										stopOpacity: .6
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "100%",
										stopColor: "#2563EB",
										stopOpacity: 0
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
									id: "gFraud",
									x1: "0",
									x2: "0",
									y1: "0",
									y2: "1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "0%",
										stopColor: "#EF4444",
										stopOpacity: .5
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "100%",
										stopColor: "#EF4444",
										stopOpacity: 0
									})]
								})] }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "3 3",
									stroke: "rgba(255,255,255,0.05)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "hour",
									stroke: "rgba(255,255,255,0.4)",
									fontSize: 11,
									tickLine: false,
									axisLine: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									stroke: "rgba(255,255,255,0.4)",
									fontSize: 11,
									tickLine: false,
									axisLine: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
									background: "rgba(15,23,42,0.9)",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: 12
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
									type: "monotone",
									dataKey: "volume",
									stroke: "#60A5FA",
									strokeWidth: 2,
									fill: "url(#gVol)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
									type: "monotone",
									dataKey: "fraud",
									stroke: "#EF4444",
									strokeWidth: 2,
									fill: "url(#gFraud)"
								})
							]
						}) })
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "glass rounded-2xl p-5 relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium text-white",
							children: "Fraud by weekday"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: "Last 30 days"
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "group relative inline-flex items-center",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "text-muted-foreground hover:text-cyan-400 focus:outline-none transition-colors",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "h-4 w-4" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "pointer-events-none absolute right-0 top-full mt-2 hidden w-72 rounded-xl border border-white/10 bg-slate-900/95 p-3 text-xs text-slate-200 shadow-2xl backdrop-blur-md group-hover:block z-50",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-semibold text-cyan-300",
									children: "Fraud by Weekday"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-[11px] text-muted-foreground leading-relaxed",
									children: "Compares overall fraud attempts across each day of the week to see if fraud attacks spike on specific days (e.g. weekends)."
								})]
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-72",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: WEEKDAY_FALLBACK,
							margin: {
								top: 8,
								right: 8,
								left: -20,
								bottom: 0
							},
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
									id: "gBar",
									x1: "0",
									x2: "0",
									y1: "0",
									y2: "1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "0%",
										stopColor: "#8B5CF6"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
										offset: "100%",
										stopColor: "#2563EB"
									})]
								}) }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "3 3",
									stroke: "rgba(255,255,255,0.05)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "day",
									stroke: "rgba(255,255,255,0.4)",
									fontSize: 11,
									tickLine: false,
									axisLine: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									stroke: "rgba(255,255,255,0.4)",
									fontSize: 11,
									tickLine: false,
									axisLine: false
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, { contentStyle: {
									background: "rgba(15,23,42,0.9)",
									border: "1px solid rgba(255,255,255,0.1)",
									borderRadius: 12
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "fraud",
									fill: "url(#gBar)",
									radius: [
										6,
										6,
										0,
										0
									]
								})
							]
						}) })
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-1 gap-4 lg:grid-cols-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveTable, { rows: recentTx }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertsPanel, { alerts })]
			})
		]
	});
}
function Kpi({ label, value, delta, up, tone, icon }) {
	const tint = tone === "danger" ? "text-[color:var(--danger)]" : tone === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--cyan)]";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
		initial: {
			opacity: 0,
			y: 6
		},
		animate: {
			opacity: 1,
			y: 0
		},
		className: "glass rounded-2xl p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `flex items-center gap-2 text-xs text-muted-foreground`,
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: tint,
						children: icon
					}),
					" ",
					label
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1.5 text-2xl font-semibold",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: `mt-0.5 inline-flex items-center gap-1 text-xs ${up ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`,
				children: [up ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-3 w-3" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "h-3 w-3" }), delta]
			})
		]
	});
}
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
function LiveTable({ rows }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass rounded-2xl p-5 lg:col-span-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3 flex items-center justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-medium",
				children: "Live transactions"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted-foreground",
				children: "Updated via WebSocket"
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-1 text-xs text-[color:var(--success)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" }), " Streaming"]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "overflow-x-auto",
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
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r) => {
					const meta = statusMeta(r.status);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-white/5 last:border-0",
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
										className: "h-1.5 w-16 overflow-hidden rounded-full bg-white/5",
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
		})]
	});
}
function AlertsPanel({ alerts }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass rounded-2xl p-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-sm font-medium",
				children: "Alerts"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted-foreground",
				children: "Priority-ranked"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "space-y-2",
			children: alerts.map((a) => {
				const tone = a.severity === "danger" ? "text-[color:var(--danger)]" : a.severity === "warning" ? "text-[color:var(--warning)]" : "text-[color:var(--cyan)]";
				const bg = a.severity === "danger" ? "bg-[color:var(--danger)]/10" : a.severity === "warning" ? "bg-[color:var(--warning)]/10" : "bg-[color:var(--cyan)]/10";
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.li, {
					initial: {
						opacity: 0,
						x: 6
					},
					animate: {
						opacity: 1,
						x: 0
					},
					className: `flex items-start gap-3 rounded-xl border border-white/5 p-3 ${bg}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: `mt-0.5 h-4 w-4 ${tone}` }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "truncate text-sm",
							children: a.message
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: a.time
						})]
					})]
				}, a.id);
			})
		})]
	});
}
//#endregion
export { OverviewPage as component };
