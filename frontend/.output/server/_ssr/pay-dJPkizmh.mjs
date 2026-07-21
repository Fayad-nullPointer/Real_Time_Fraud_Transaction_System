import { a as __toESM } from "../_runtime.mjs";
import { n as AnimatePresence, t as motion } from "../_libs/framer-motion.mjs";
import { f as terminalApi, o as getCustomer, p as txApi, r as clearCustomerToken, t as authApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { g as Link, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { B as DollarSign, E as LogOut, H as CreditCard, K as CircleCheck, N as History, O as LoaderCircle, _ as Search, c as TriangleAlert, j as KeyRound, l as TrendingUp, nt as ArrowRight, p as ShieldCheck, w as MapPin } from "../_libs/lucide-react.mjs";
import { t as GoogleTerminalMap } from "./GoogleTerminalMap-wSxea593.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pay-dJPkizmh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function formatRelativeTime(dateStr) {
	try {
		const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1e3));
		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	} catch {
		return "recently";
	}
}
function getStatusBadge(status) {
	switch (status) {
		case "APPROVED": return {
			label: "Approved",
			color: "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30"
		};
		case "VERIFIED": return {
			label: "OTP Verified",
			color: "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)] border-[color:var(--cyan)]/30"
		};
		case "PENDING_OTP": return {
			label: "OTP Pending",
			color: "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30"
		};
		case "DECLINED": return {
			label: "Fraud Blocked",
			color: "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border-[color:var(--danger)]/30"
		};
		default: return {
			label: status,
			color: "bg-white/10 text-muted-foreground border-white/10"
		};
	}
}
function mapShapContributions(topReasons, amt = 0, prob = .1) {
	if (topReasons && topReasons.length > 0) {
		const labelMap = {
			TX_AMOUNT: "Transaction Amount",
			DIST_FROM_HOME: "Distance from home",
			TERMINAL_RISK: "Terminal Risk",
			NIGHT_TX: "Night Transaction",
			CUSTOMER_VELOCITY: "Customer velocity (24h)",
			OTP_NOT_ENTERED: "OTP Verification Required"
		};
		return topReasons.map((r) => {
			const val = Math.abs(r.shap_value);
			const impact = val > .3 ? "High" : val > .1 ? "Medium" : "Low";
			return {
				name: labelMap[r.feature] ?? r.feature.replace(/_/g, " "),
				impact,
				value: Math.min(1, Math.max(.1, val)),
				direction: r.shap_value >= 0 ? 1 : -1
			};
		});
	}
	return [
		{
			name: "Transaction Amount",
			impact: amt > 500 ? "High" : "Medium",
			value: Math.min(1, Math.max(.08, amt / 1500)),
			direction: 1
		},
		{
			name: "Distance from home",
			impact: "Medium",
			value: .15,
			direction: -1
		},
		{
			name: "Terminal Risk",
			impact: "Low",
			value: .08,
			direction: -1
		},
		{
			name: "Night Transaction",
			impact: "Low",
			value: .05,
			direction: -1
		},
		{
			name: "Customer velocity (24h)",
			impact: "Low",
			value: .12,
			direction: -1
		}
	];
}
function PayPage() {
	const navigate = useNavigate();
	const [apiTerminals, setApiTerminals] = (0, import_react.useState)([]);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [amount, setAmount] = (0, import_react.useState)("");
	const [query, setQuery] = (0, import_react.useState)("");
	const [phase, setPhase] = (0, import_react.useState)("form");
	const [prediction, setPrediction] = (0, import_react.useState)(null);
	const [otp, setOtp] = (0, import_react.useState)("");
	const [otpOutcome, setOtpOutcome] = (0, import_react.useState)(null);
	const [pendingTxId, setPendingTxId] = (0, import_react.useState)(null);
	const [userLoc, setUserLoc] = (0, import_react.useState)(null);
	const [otpSeconds, setOtpSeconds] = (0, import_react.useState)(0);
	const countdownRef = (0, import_react.useRef)(null);
	const [regLocation, setRegLocation] = (0, import_react.useState)("Loading location...");
	const [recentTxns, setRecentTxns] = (0, import_react.useState)([]);
	const customer = getCustomer();
	const cardNumber = customer?.customer_id ? String(customer.customer_id) : typeof window !== "undefined" ? localStorage.getItem("sentinel:cardNumber") ?? "—" : "—";
	const refreshHistory = (0, import_react.useCallback)(() => {
		txApi.history(6).then(setRecentTxns).catch(() => {});
	}, []);
	const refreshProfile = (0, import_react.useCallback)(() => {
		authApi.me().then((me) => {
			setRegLocation(me.location || "Cairo, Egypt");
		}).catch(() => {
			setRegLocation("Cairo, Egypt");
		});
	}, []);
	(0, import_react.useEffect)(() => {
		terminalApi.list().then((list) => {
			setApiTerminals(list);
			if (list.length > 0) setSelected(list[0]);
		}).catch(() => {});
		refreshProfile();
		refreshHistory();
		if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition((p) => {
			const coords = {
				lat: p.coords.latitude,
				lon: p.coords.longitude
			};
			setUserLoc(coords);
			authApi.updateLocation(coords.lat, coords.lon).then((res) => {
				if (res.location && res.location !== "Unknown") setRegLocation(res.location);
			}).catch(() => {});
		}, () => {}, { timeout: 8e3 });
	}, [refreshProfile, refreshHistory]);
	const filtered = (0, import_react.useMemo)(() => {
		if (!query) return apiTerminals;
		const q = query.toLowerCase();
		return apiTerminals.filter((t) => String(t.terminal_id).toLowerCase().includes(q) || t.terminal_name.toLowerCase().includes(q));
	}, [query, apiTerminals]);
	const lastTxnText = (0, import_react.useMemo)(() => {
		if (recentTxns.length === 0) return "No transactions yet";
		const last = recentTxns[0];
		return `$${last.tx_amount.toFixed(2)} · ${formatRelativeTime(last.tx_datetime)}`;
	}, [recentTxns]);
	(0, import_react.useEffect)(() => {
		if (phase === "otp") {
			setOtpSeconds(300);
			countdownRef.current = setInterval(() => {
				setOtpSeconds((prev) => {
					if (prev <= 1) {
						if (countdownRef.current) clearInterval(countdownRef.current);
						if (pendingTxId) txApi.decline(pendingTxId).catch(() => {});
						setOtpOutcome("fail");
						setPhase("final");
						refreshHistory();
						toast.error("OTP timed out. Transaction auto-declined.");
						return 0;
					}
					return prev - 1;
				});
			}, 1e3);
		} else if (countdownRef.current) clearInterval(countdownRef.current);
		return () => {
			if (countdownRef.current) clearInterval(countdownRef.current);
		};
	}, [
		phase,
		pendingTxId,
		refreshHistory
	]);
	const formatTimer = (sec) => {
		const m = Math.floor(sec / 60);
		const s = sec % 60;
		return `${m}:${s < 10 ? "0" : ""}${s}`;
	};
	const submit = async () => {
		const amt = parseFloat(amount);
		if (!selected) {
			toast.error("Select a terminal on the map");
			return;
		}
		if (!amt || amt <= 0) {
			toast.error("Enter a valid amount");
			return;
		}
		setPhase("predicting");
		try {
			const res = await txApi.create({
				terminal_id: selected.terminal_id,
				tx_amount: amt,
				lat: userLoc?.lat,
				lon: userLoc?.lon
			});
			const prob = res.fraud_probability ?? .05;
			const label = prob > .55 ? "fraud" : "legit";
			const confidence = label === "legit" ? Math.min(.99, Math.max(.72, 1 - prob)) : Math.min(.99, Math.max(.7, prob));
			const contributions = mapShapContributions(res.top_reasons, amt, prob);
			if (res.status === "PENDING_OTP") {
				setPendingTxId(res.transaction_id);
				setPrediction({
					probability: prob,
					label,
					confidence,
					contributions
				});
				setOtp("");
				refreshHistory();
				setPhase("otp");
			} else if (res.status === "APPROVED") {
				setPrediction({
					probability: prob,
					label: "legit",
					confidence,
					contributions
				});
				setOtpOutcome("success");
				setPhase("final");
				refreshHistory();
				toast.success(res.message ?? "Transaction approved");
			} else {
				toast.error(res.message ?? "Transaction failed");
				setPhase("form");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Transaction failed");
			setPhase("form");
		}
	};
	const startOtp = () => {
		setPhase("otp");
		setOtp("");
		setOtpOutcome(null);
	};
	const verifyOtp = async () => {
		if (otp.length < 4) {
			toast.error("Enter the verification code");
			return;
		}
		if (!pendingTxId) return;
		try {
			if ((await txApi.verify(pendingTxId, otp)).status === "VERIFIED") {
				setOtpOutcome("success");
				setPhase("final");
				refreshHistory();
				toast.success("OTP Verified — Transaction completed");
			} else {
				setOtpOutcome("fail");
				setPhase("final");
				refreshHistory();
				toast.error("OTP Failed — Transaction declined");
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "OTP verification failed");
			setOtpOutcome("fail");
			setPhase("final");
			refreshHistory();
		}
	};
	const reset = () => {
		setPhase("form");
		setPrediction(null);
		setAmount("");
		setOtp("");
		setOtpOutcome(null);
		setPendingTxId(null);
		refreshHistory();
	};
	const logout = () => {
		clearCustomerToken();
		try {
			localStorage.removeItem("sentinel:cardNumber");
			localStorage.removeItem("sentinel:profile");
		} catch {}
		toast.success("Signed out successfully");
		navigate({ to: "/login" });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "sticky top-0 z-30 border-b border-white/5 bg-[color:var(--background)]/70 backdrop-blur-xl",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex h-16 max-w-7xl items-center justify-between px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4 text-white" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold",
							children: "Sentinel"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 text-xs text-muted-foreground",
							children: "Customer Portal"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/profile",
						className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, { className: "h-3.5 w-3.5" }), " Profile"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: logout,
						className: "relative z-50 cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition-colors",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, { className: "h-3.5 w-3.5 text-rose-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Sign out" })]
					})]
				})]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto max-w-7xl px-6 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "grid grid-cols-2 gap-3 md:grid-cols-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountCard, {
							label: "Customer ID",
							value: cardNumber,
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountCard, {
							label: "Registered location",
							value: regLocation,
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountCard, {
							label: "Last transaction",
							value: lastTxnText,
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrendingUp, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountCard, {
							label: "Account status",
							value: "Active",
							tone: "success",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-4 w-4" })
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "glass rounded-2xl p-5 lg:col-span-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-medium",
								children: "Select a terminal on Google Map"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Click any marker or search by terminal name/ID."
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3.5 w-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: query,
									onChange: (e) => setQuery(e.target.value),
									placeholder: "Search terminal...",
									className: "w-40 bg-transparent py-1.5 text-xs outline-none"
								})]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoogleTerminalMap, {
								terminals: filtered,
								selectedId: selected?.terminal_id ?? null,
								onSelect: (t) => setSelected(t),
								userCoords: userLoc ? {
									lat: userLoc.lat,
									lng: userLoc.lon
								} : null,
								height: "440px"
							})
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "glass rounded-2xl p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-medium",
								children: "New transaction"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Real-time fraud scoring powered by Sentinel ML."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mt-5 block text-xs text-muted-foreground",
								children: "Selected terminal"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-1.5 flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm",
								children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "font-mono text-sm",
									children: ["TRM-", selected.terminal_id]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground",
									children: selected.terminal_name
								})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: "No terminal selected"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "mt-4 block text-xs text-muted-foreground",
								children: "Amount (USD)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DollarSign, { className: "h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: amount,
									onChange: (e) => setAmount(e.target.value),
									inputMode: "decimal",
									placeholder: "0.00",
									className: "w-full bg-transparent py-3 text-sm outline-none"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: submit,
								disabled: phase === "predicting",
								className: "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-70",
								children: phase === "predicting" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Scoring…"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: ["Submit transaction ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "h-4 w-4" })] })
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, { children: (phase === "result" || phase === "otp" || phase === "final") && prediction && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.section, {
					initial: {
						opacity: 0,
						y: 12
					},
					animate: {
						opacity: 1,
						y: 0
					},
					exit: { opacity: 0 },
					className: "mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `glass-strong rounded-2xl p-6 lg:col-span-2 ${prediction.label === "fraud" ? "ring-1 ring-[color:var(--danger)]/40" : "ring-1 ring-[color:var(--success)]/30"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs uppercase tracking-wider text-muted-foreground",
										children: "Prediction"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-1 text-2xl font-semibold",
										children: phase === "final" && otpOutcome === "success" ? "Verified Legitimate" : prediction.label === "fraud" ? "Fraudulent" : "Legitimate"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-1 text-sm text-muted-foreground",
										children: [
											"Confidence ",
											(prediction.confidence * 100).toFixed(1),
											"% · Risk ",
											riskLevel(prediction.probability)
										]
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProbabilityRing, {
									value: prediction.probability,
									label: prediction.label
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 space-y-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs uppercase tracking-wider text-muted-foreground",
									children: "Feature contributions"
								}), prediction.contributions.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between text-sm",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: c.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-xs text-muted-foreground",
										children: [c.impact, " impact"]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1.5 h-2 overflow-hidden rounded-full bg-white/5",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: `h-full rounded-full ${c.direction === 1 ? "bg-[color:var(--danger)]" : "bg-[color:var(--success)]"}`,
										style: { width: `${Math.round(c.value * 100)}%` }
									})
								})] }, c.name))]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 flex flex-wrap gap-2",
								children: [prediction.label === "fraud" && phase !== "final" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									onClick: startOtp,
									className: "inline-flex items-center gap-1.5 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-4 w-4" }), " Open OTP Verification Window"]
								}), phase === "final" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: reset,
									className: "rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10",
									children: "Make another transaction"
								})]
							})
						]
					}), phase === "final" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
						initial: {
							opacity: 0,
							scale: .96
						},
						animate: {
							opacity: 1,
							scale: 1
						},
						className: "glass-strong rounded-2xl p-6",
						children: otpOutcome === "success" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--success)]/15 text-[color:var(--success)]",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-5 w-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mt-3 font-semibold",
								children: "Payment Approved"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "OTP was verified successfully. The transaction was processed."
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--danger)]/15 text-[color:var(--danger)]",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-5 w-5" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mt-3 font-semibold",
								children: "Payment Blocked"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: "OTP verification failed or timed out. Transaction declined as fraudulent."
							})
						] })
					})]
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "glass rounded-2xl p-6 mt-8",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-white",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(History, { className: "h-4 w-4 text-[color:var(--cyan)]" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "font-semibold text-base",
								children: "Most Recent Transactions"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Your recent card activity and verification status."
							})] })]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: refreshHistory,
							className: "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-white transition",
							children: "Refresh"
						})]
					}), recentTxns.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground",
						children: "No transactions recorded yet. Submit your first payment above!"
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-xs text-muted-foreground border-b border-white/10",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 px-3 font-medium",
										children: "Transaction ID"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 px-3 font-medium",
										children: "Terminal"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 px-3 font-medium",
										children: "Date & Time"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 px-3 font-medium",
										children: "Amount"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 px-3 font-medium",
										children: "Risk Score"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "py-2.5 px-3 font-medium",
										children: "Status"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
								className: "divide-y divide-white/5",
								children: recentTxns.map((tx) => {
									const badge = getStatusBadge(tx.status);
									return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
										className: "hover:bg-white/[0.02] transition",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3 px-3 font-mono text-xs text-muted-foreground",
												children: [tx.transaction_id.slice(0, 12), "…"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3 px-3 font-medium text-xs",
												children: ["TRM-", tx.terminal_id]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-3 text-xs text-muted-foreground",
												children: new Date(tx.tx_datetime).toLocaleString()
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3 px-3 font-semibold text-sm",
												children: ["$", tx.tx_amount.toFixed(2)]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
												className: "py-3 px-3 text-xs font-mono",
												children: ["p=", (tx.fraud_probability ?? 0).toFixed(2)]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
												className: "py-3 px-3",
												children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: `inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${badge.color}`,
													children: badge.label
												})
											})
										]
									}, tx.transaction_id);
								})
							})]
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, { children: phase === "otp" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "fixed inset-0 z-50 flex items-center justify-center p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
						initial: { opacity: 0 },
						animate: { opacity: 1 },
						exit: { opacity: 0 },
						onClick: () => setPhase("result"),
						className: "absolute inset-0 bg-black/80 backdrop-blur-md"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
						initial: {
							opacity: 0,
							scale: .92,
							y: 20
						},
						animate: {
							opacity: 1,
							scale: 1,
							y: 0
						},
						exit: {
							opacity: 0,
							scale: .92,
							y: 20
						},
						transition: {
							type: "spring",
							damping: 25,
							stiffness: 300
						},
						className: "relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-start justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "grid h-10 w-10 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-lg",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { className: "h-5 w-5" })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-lg font-semibold tracking-tight text-white",
										children: "Security OTP Verification"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-xs text-muted-foreground",
										children: "Sentinel Fraud Shield"
									})] })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-xs font-medium text-amber-400",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "⏱" }),
										" ",
										formatTimer(otpSeconds)
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-200/90",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center gap-2 font-medium text-amber-300",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-4 w-4 shrink-0 text-amber-400" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "High-Risk Transaction Flagged" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1",
									children: "We sent a 6-digit verification code to your registered phone number via SMS / WhatsApp. Enter it below to authorize this payment."
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
									className: "block text-xs font-medium uppercase tracking-wider text-muted-foreground",
									children: "6-Digit Verification Code"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: otp,
									onChange: (e) => setOtp(e.target.value),
									placeholder: "123456",
									maxLength: 6,
									autoFocus: true,
									className: "mt-2 w-full rounded-2xl border border-white/15 bg-black/60 px-4 py-3.5 text-center font-mono text-2xl tracking-[0.4em] text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 flex flex-col gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: verifyOtp,
									className: "w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--shadow-glow)] transition hover:brightness-110 active:scale-[0.99]",
									children: "Confirm & Authorize Transaction"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setPhase("result"),
									className: "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-white",
									children: "Close / Return to Transaction"
								})]
							})
						]
					})]
				}) })
			]
		})]
	});
}
function AccountCard({ label, value, icon, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass rounded-xl p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 text-xs text-muted-foreground",
			children: [icon, label]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: `mt-2 font-mono text-base font-semibold ${tone === "success" ? "text-[color:var(--success)]" : "text-foreground"}`,
			children: value
		})]
	});
}
function ProbabilityRing({ value, label }) {
	const stroke = label === "fraud" ? "var(--danger)" : "var(--success)";
	const pct = Math.round(value * 100);
	const r = 36;
	const c = 2 * Math.PI * r;
	const offset = c - pct / 100 * c;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-24 w-24 shrink-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			className: "h-full w-full -rotate-90",
			viewBox: "0 0 96 96",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "48",
				cy: "48",
				r,
				stroke: "rgba(255,255,255,0.08)",
				strokeWidth: "8",
				fill: "none"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "48",
				cy: "48",
				r,
				stroke,
				strokeWidth: "8",
				fill: "none",
				strokeDasharray: c,
				strokeDashoffset: offset,
				strokeLinecap: "round",
				className: "transition-all duration-700"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute inset-0 flex flex-col items-center justify-center text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "font-mono text-lg font-bold",
				children: [pct, "%"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[10px] text-muted-foreground uppercase",
				children: label
			})]
		})]
	});
}
function riskLevel(prob) {
	if (prob > .8) return "Critical";
	if (prob > .55) return "High";
	if (prob > .3) return "Moderate";
	return "Low";
}
//#endregion
export { PayPage as component };
