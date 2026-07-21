import { a as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { G as CircleQuestionMark, K as CircleCheck, M as Info, f as Sparkles, it as Activity } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/FeatureProfileViewer-BefmIC0g.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FEATURE_EXPLANATIONS = {
	Z_score: {
		label: "Z-Score Anomaly",
		description: "Measures how many standard deviations this transaction amount is away from your historical personal mean spend."
	},
	mean_amount: {
		label: "Historical Mean Amount",
		description: "Your average transaction amount computed across all your previous valid transactions."
	},
	std_amount: {
		label: "Spending Variance (Std Dev)",
		description: "The normal fluctuation/range of your purchase amounts around your average."
	},
	spending_tier: {
		label: "Spending Tier",
		description: "Classification of your account spend level (e.g. Low, Medium, High) compared to the overall population."
	},
	amount_to_mean_ratio: {
		label: "Ratio to Mean Amount",
		description: "Ratio of current transaction amount divided by your personal average transaction amount."
	},
	peer_group_amount_ratio: {
		label: "Peer Group Amount Ratio",
		description: "Comparison of your purchase amount against other customers in your same spending tier."
	},
	tx_count_1h: {
		label: "1-Hour Transaction Velocity",
		description: "Number of transactions completed on your account within the past 60 minutes."
	},
	tx_count_4h: {
		label: "4-Hour Transaction Velocity",
		description: "Number of transactions completed on your account within the past 4 hours."
	},
	night_velocity: {
		label: "Night Velocity Rate",
		description: "Frequency of late-night transactions (11 PM - 5 AM) initiated on your card."
	},
	PREV_TX_AMOUNT_lag1: {
		label: "Previous Transaction Amount (Lag 1)",
		description: "The dollar amount of your immediately preceding transaction."
	},
	PREV_TX_AMOUNT_lag2: {
		label: "2nd Previous Transaction Amount (Lag 2)",
		description: "The dollar amount of your transaction 2 steps ago."
	},
	PREV_TX_AMOUNT_lag3: {
		label: "3rd Previous Transaction Amount (Lag 3)",
		description: "The dollar amount of your transaction 3 steps ago."
	},
	ratio_to_lag1: {
		label: "Ratio to Previous Tx Amount",
		description: "Ratio comparing current purchase amount against your previous purchase amount."
	},
	is_test_tx_sequence: {
		label: "Micro-Probe Test Pattern",
		description: "Flag indicating a small transaction followed by a large transaction (micro-probing pattern)."
	},
	terminal_fraud_rate_7d: {
		label: "Terminal 7-Day Fraud Rate",
		description: "Historical fraud incident percentage at the selected payment terminal over the last 7 days."
	},
	terminal_fraud_rate_28d: {
		label: "Terminal 28-Day Fraud Rate",
		description: "Historical fraud incident percentage at the selected payment terminal over the last 28 days."
	},
	night_fraud_rate: {
		label: "Night Time Fraud Index",
		description: "Baseline probability of fraud occurring during night hours across all terminals."
	},
	distance: {
		label: "Distance from Registered Home",
		description: "Calculated geodesic distance (in kilometers) between your registered home location and the payment terminal."
	},
	last_amounts_chronological: {
		label: "Recent Purchase Amount History",
		description: "Sliding window of your most recent purchase amounts evaluated for short-term spending patterns."
	},
	tx_count_1h_approx: {
		label: "1-Hour Transaction Count",
		description: "Number of transactions completed on your card within the last 60 minutes."
	},
	tx_count_4h_approx: {
		label: "4-Hour Transaction Count",
		description: "Number of transactions completed on your card within the last 4 hours."
	},
	cold_start_running_n: {
		label: "Cold Start Running N",
		description: "Number of completed transactions during cold start period."
	},
	cold_start_running_mean: {
		label: "Running Learning Mean",
		description: "Welford online running average calculated during the initial learning phase."
	},
	OTP_NOT_ENTERED: {
		label: "OTP Verification Timed Out",
		description: "Customer failed to submit the valid 2FA verification code before expiry, causing the transaction to be auto-declined."
	}
};
function formatFeatureKey(key) {
	if (FEATURE_EXPLANATIONS[key]) return FEATURE_EXPLANATIONS[key].label;
	return key.replace(/_/g, " ").replace(/\b([a-z])/g, (match) => match.toUpperCase()).replace(/\bTx\b/g, "Transaction").replace(/\bStd\b/g, "Standard");
}
function FeatureProfileViewer({ mlState }) {
	const [activeTooltip, setActiveTooltip] = (0, import_react.useState)(null);
	if (!mlState) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-muted-foreground",
		children: "Loading ML Behavioral Profile..."
	});
	const totalTxnsCount = mlState.db_stats?.total_txns ?? mlState.realtime?.cold_start_running_n ?? 0;
	const isColdStart = mlState.is_cold_start && totalTxnsCount < 5;
	const profile = mlState.profile;
	const realtime = mlState.realtime;
	const rawFeatures = {
		...profile || {},
		...realtime || {}
	};
	const featureList = Object.entries(rawFeatures).filter(([k]) => {
		const ignored = [
			"customer_id",
			"known_profile",
			"is_cold_start",
			"is_warm",
			"buffered_tx_times",
			"x_customer_id",
			"y_customer_id"
		];
		if (!isColdStart && (k === "cold_start_running_n" || k === "cold_start_running_mean")) return false;
		return !ignored.includes(k);
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `rounded-2xl border p-5 ${isColdStart ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: `grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isColdStart ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`,
						children: isColdStart ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkles, { className: "h-5 w-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-5 w-5" })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-semibold text-base",
							children: isColdStart ? "New Customer (Cold-Start Learning Mode)" : "Established Behavioral Profile Active"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: `rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${isColdStart ? "border-amber-500/40 bg-amber-500/20 text-amber-300" : "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"}`,
							children: isColdStart ? "Learning" : "Warmed & Active"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground leading-relaxed",
						children: isColdStart ? `You have completed ${totalTxnsCount} transaction(s). Sentinel ML is actively running Welford online learning to construct your personal baseline spending mean ($${profile?.mean_amount?.toFixed(2) ?? "0.00"}) before promoting you out of cold-start mode.` : `Sentinel ML has learned your unique behavioral patterns across your ${totalTxnsCount} transactions (historical mean: $${profile?.mean_amount?.toFixed(2) ?? "0.00"}, spending variance: $${profile?.std_amount?.toFixed(2) ?? "0.00"}) and evaluates every new purchase against your personal baseline.`
					})] })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 md:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass rounded-xl p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: "Historical Mean Spend"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1.5 font-mono text-lg font-semibold text-white",
							children: ["$", profile?.mean_amount ? profile.mean_amount.toFixed(2) : realtime?.cold_start_running_mean ? realtime.cold_start_running_mean.toFixed(2) : "—"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass rounded-xl p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: "Spending Variance (Std Dev)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1.5 font-mono text-lg font-semibold text-cyan-400",
							children: ["$", profile?.std_amount ? profile.std_amount.toFixed(2) : "—"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass rounded-xl p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: "Spending Tier"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-1.5 font-semibold text-[color:var(--success)]",
							children: mlState.spending_tier ?? "Standard Tier"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass rounded-xl p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: "Recent 1h / 4h Velocity"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1.5 font-mono text-lg font-semibold text-amber-400",
							children: [
								realtime?.tx_count_1h_approx ?? 0,
								" / ",
								realtime?.tx_count_4h_approx ?? 0,
								" txns"
							]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "h-4 w-4 text-[color:var(--cyan)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "font-semibold text-sm",
							children: "Stored Model Features & Baselines"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-muted-foreground",
						children: "Click any feature to read explanation"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 grid grid-cols-1 gap-3 md:grid-cols-2",
					children: featureList.map(([key, val]) => {
						const label = formatFeatureKey(key);
						const explanation = FEATURE_EXPLANATIONS[key];
						const isTooltipOpen = activeTooltip === key;
						let displayVal = "—";
						if (typeof val === "number") displayVal = val % 1 === 0 ? val.toString() : val.toFixed(2);
						else if (typeof val === "boolean") displayVal = val ? "True" : "False";
						else if (Array.isArray(val)) displayVal = val.length > 0 ? val.map((v) => typeof v === "number" ? `$${v.toFixed(2)}` : v).join(", ") : "None";
						else if (val !== null && val !== void 0) displayVal = String(val);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							onClick: () => setActiveTooltip(isTooltipOpen ? null : key),
							className: "relative cursor-pointer rounded-xl border border-white/10 bg-white/[0.02] p-3.5 transition hover:border-cyan-500/40 hover:bg-white/[0.04]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs font-medium text-foreground",
										children: label
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleQuestionMark, { className: "h-3.5 w-3.5 text-muted-foreground transition hover:text-cyan-400" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-xs font-semibold text-cyan-300",
									children: displayVal
								})]
							}), isTooltipOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2.5 rounded-lg border border-cyan-500/30 bg-slate-900/90 p-3 text-xs text-cyan-100 shadow-xl backdrop-blur-md",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-semibold text-cyan-400 flex items-center gap-1",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Info, { className: "h-3.5 w-3.5" }),
										" ",
										label
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 leading-relaxed text-slate-300",
									children: explanation ? explanation.description : `Calculated pipeline feature (${key}) evaluated during transaction scoring.`
								})]
							})]
						}, key);
					})
				})]
			})
		]
	});
}
//#endregion
export { FeatureProfileViewer as n, formatFeatureKey as r, FEATURE_EXPLANATIONS as t };
