import { a as __toESM } from "../_runtime.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { o as getCustomer, p as txApi, r as clearCustomerToken, t as authApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { g as Link, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { B as DollarSign, E as LogOut, T as Mail, U as Cpu, W as Copy, Y as ChevronLeft, b as Phone, c as TriangleAlert, it as Activity, p as ShieldCheck, w as MapPin } from "../_libs/lucide-react.mjs";
import { n as FeatureProfileViewer } from "./FeatureProfileViewer-BefmIC0g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-B_TPXRHC.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEFAULT_PROFILE = {
	cardNumber: "—",
	phone: "—",
	email: "customer@sentinel.app",
	fullName: "Customer",
	city: "—",
	country: "—",
	coords: null,
	createdAt: (/* @__PURE__ */ new Date()).toISOString(),
	tier: "Standard",
	notifyEmail: true,
	notifySms: true,
	notifyPush: false
};
function buildProfileFromCustomer() {
	const isBrowser = typeof window !== "undefined";
	const customer = getCustomer();
	const base = { ...DEFAULT_PROFILE };
	if (customer) {
		base.cardNumber = String(customer.customer_id ?? "—");
		base.phone = customer.phone_number ?? "—";
		base.fullName = customer.full_name || base.fullName;
	} else if (isBrowser) base.cardNumber = localStorage.getItem("sentinel:cardNumber") ?? "—";
	if (isBrowser) try {
		const raw = localStorage.getItem("sentinel:profile");
		if (raw) return {
			...base,
			...JSON.parse(raw)
		};
	} catch {}
	return base;
}
function getStatusDisplay(status) {
	return {
		APPROVED: {
			label: "Legitimate",
			color: "text-[color:var(--success)]",
			dot: "bg-[color:var(--success)]"
		},
		VERIFIED: {
			label: "OTP Verified",
			color: "text-[color:var(--cyan)]",
			dot: "bg-[color:var(--cyan)]"
		},
		PENDING_OTP: {
			label: "OTP Pending",
			color: "text-[color:var(--warning)]",
			dot: "bg-[color:var(--warning)]"
		},
		DECLINED: {
			label: "Fraud Blocked",
			color: "text-[color:var(--danger)]",
			dot: "bg-[color:var(--danger)]"
		}
	}[status] ?? {
		label: status,
		color: "text-muted-foreground",
		dot: "bg-white/30"
	};
}
function ProfilePage() {
	const navigate = useNavigate();
	const [profile, setProfile] = (0, import_react.useState)(DEFAULT_PROFILE);
	const [draft, setDraft] = (0, import_react.useState)(DEFAULT_PROFILE);
	const [editing, setEditing] = (0, import_react.useState)(false);
	const [mounted, setMounted] = (0, import_react.useState)(false);
	const [txHistory, setTxHistory] = (0, import_react.useState)([]);
	const [mlState, setMlState] = (0, import_react.useState)(null);
	const [activeTab, setActiveTab] = (0, import_react.useState)("overview");
	(0, import_react.useEffect)(() => {
		const p = buildProfileFromCustomer();
		setProfile(p);
		setDraft(p);
		setMounted(true);
		txApi.history(200).then((h) => setTxHistory(h)).catch(() => {});
		authApi.myState().then((state) => {
			setMlState(state);
		}).catch(() => {});
		authApi.me().then((me) => {
			if (me.location) {
				const parts = me.location.split(",");
				setProfile((prev) => ({
					...prev,
					city: parts[0]?.trim() || prev.city,
					country: parts[parts.length - 1]?.trim() || prev.country
				}));
			}
		}).catch(() => {});
	}, []);
	const recent = txHistory.slice(0, 8);
	const stats = (0, import_react.useMemo)(() => {
		const total = mlState?.db_stats?.total_txns ?? txHistory.length;
		const spend = mlState?.db_stats?.total_spend ?? txHistory.reduce((a, b) => a + b.tx_amount, 0);
		const flagged = mlState?.db_stats?.fraud_count ?? txHistory.filter((t) => t.is_fraud || t.fraud_probability > .55).length;
		const verified = txHistory.filter((t) => t.status === "VERIFIED").length;
		const avgProb = mlState?.db_stats?.avg_prob ?? (total > 0 ? txHistory.reduce((a, b) => a + (b.fraud_probability ?? 0), 0) / total : 0);
		const risk = Math.min(100, Math.round(avgProb * 100));
		return {
			total,
			flagged,
			verified,
			spend: Math.round(spend),
			risk
		};
	}, [txHistory, mlState]);
	const logout = () => {
		clearCustomerToken();
		try {
			localStorage.removeItem("sentinel:cardNumber");
			localStorage.removeItem("sentinel:profile");
		} catch {}
		toast.success("Signed out successfully");
		navigate({ to: "/login" });
	};
	const copyCard = () => {
		navigator.clipboard.writeText(profile.cardNumber);
		toast.success("Card number copied");
	};
	const initials = (profile.fullName || "C").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
	if (!mounted) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "min-h-screen" });
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
						to: "/pay",
						className: "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-3.5 w-3.5" }), " Back to portal"]
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
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
					initial: {
						opacity: 0,
						y: 8
					},
					animate: {
						opacity: 1,
						y: 0
					},
					className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-semibold tracking-tight",
						children: "Customer Profile"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Manage your identity, view real risk statistics, and inspect ML behavioral features."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("overview"),
							className: `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${activeTab === "overview" ? "bg-[image:var(--gradient-primary)] text-white shadow-md" : "text-muted-foreground hover:text-white"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "h-3.5 w-3.5" }), " Overview & Activity"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							onClick: () => setActiveTab("ml_profile"),
							className: `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${activeTab === "ml_profile" ? "bg-[image:var(--gradient-primary)] text-white shadow-md" : "text-muted-foreground hover:text-white"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cpu, { className: "h-3.5 w-3.5 text-cyan-300" }), " ML Feature Profile Debugger"]
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid grid-cols-2 gap-3 md:grid-cols-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Total Transactions",
							value: stats.total.toLocaleString(),
							sub: `${stats.verified} OTP verified`,
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Total Spend",
							value: `$${stats.spend.toLocaleString()}`,
							sub: "Lifetime volume",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DollarSign, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Flagged Incidents",
							value: stats.flagged.toString(),
							sub: "High risk events",
							tone: stats.flagged > 0 ? "warning" : "default",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, { className: "h-4 w-4" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatCard, {
							label: "Real Risk Score",
							value: `${stats.risk}/100`,
							sub: stats.risk < 25 ? "Safe Baseline" : "Elevated Risk",
							tone: stats.risk < 25 ? "success" : "danger",
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4" })
						})
					]
				}),
				activeTab === "overview" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "glass-strong rounded-2xl p-6 lg:col-span-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center gap-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "grid h-16 w-16 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-lg font-semibold text-white shadow-[var(--shadow-glow)]",
									children: initials
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "truncate text-base font-medium",
										children: profile.fullName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-0.5 flex items-center gap-2 text-xs text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-3 w-3 text-[color:var(--success)]" }), " Verified"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5",
											children: profile.tier
										})]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 rounded-xl border border-white/10 bg-black/30 p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-xs text-muted-foreground",
									children: "Card Number (Customer ID)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-mono text-xl tracking-wider gradient-text",
										children: profile.cardNumber
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: copyCard,
										className: "rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5" })
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 space-y-3 text-xs",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5 text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "h-3.5 w-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-foreground",
											children: profile.phone
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5 text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "h-3.5 w-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-foreground",
											children: profile.email
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2.5 text-muted-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-3.5 w-3.5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "text-foreground",
											children: [
												profile.city,
												", ",
												profile.country
											]
										})]
									})
								]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "space-y-6 lg:col-span-2",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "glass rounded-2xl p-6",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-medium",
									children: "Transaction Activity History"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted-foreground",
									children: "All recent payments associated with your card."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/pay",
									className: "text-xs text-[color:var(--cyan)] hover:underline",
									children: "New transaction →"
								})]
							}), recent.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-muted-foreground",
								children: "No recent transaction activity recorded."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 overflow-x-auto",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
									className: "w-full text-left text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
										className: "border-b border-white/10 text-muted-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "py-2 px-3 font-medium",
												children: "Tx ID"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "py-2 px-3 font-medium",
												children: "Terminal"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "py-2 px-3 font-medium",
												children: "Date"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "py-2 px-3 font-medium",
												children: "Amount"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
												className: "py-2 px-3 font-medium",
												children: "Status"
											})
										] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
										className: "divide-y divide-white/5",
										children: recent.map((tx) => {
											const statusInfo = getStatusDisplay(tx.status);
											return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
												className: "hover:bg-white/[0.02] transition",
												children: [
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "py-2.5 px-3 font-mono text-muted-foreground",
														children: [tx.transaction_id.slice(0, 10), "…"]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "py-2.5 px-3 font-medium",
														children: ["TRM-", tx.terminal_id]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-2.5 px-3 text-muted-foreground",
														children: new Date(tx.tx_datetime).toLocaleString()
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
														className: "py-2.5 px-3 font-semibold text-foreground",
														children: ["$", tx.tx_amount.toFixed(2)]
													}),
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
														className: "py-2.5 px-3",
														children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
															className: `inline-flex items-center gap-1.5 font-medium ${statusInfo.color}`,
															children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 w-1.5 rounded-full ${statusInfo.dot}` }), statusInfo.label]
														})
													})
												]
											}, tx.transaction_id);
										})
									})]
								})
							})]
						})
					})]
				}),
				activeTab === "ml_profile" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-6",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FeatureProfileViewer, { mlState })
				})
			]
		})]
	});
}
function StatCard({ label, value, sub, tone, icon }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass rounded-xl p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), icon]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `mt-2 font-mono text-xl font-semibold ${{
					success: "text-[color:var(--success)]",
					warning: "text-amber-400",
					danger: "text-[color:var(--danger)]",
					default: "text-foreground"
				}[tone ?? "default"]}`,
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-[11px] text-muted-foreground",
				children: sub
			})
		]
	});
}
//#endregion
export { ProfilePage as component };
