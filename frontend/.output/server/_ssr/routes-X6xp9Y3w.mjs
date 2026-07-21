import { a as __toESM } from "../_runtime.mjs";
import { n as AnimatePresence, t as motion } from "../_libs/framer-motion.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { D as Lock, K as CircleCheck, Q as ChartColumn, U as Cpu, Z as ChartLine, et as Bell, it as Activity, nt as ArrowRight, p as ShieldCheck, r as Zap, w as MapPin, y as Play } from "../_libs/lucide-react.mjs";
import { t as NetworkBackdrop } from "./network-backdrop-CLFdnDnT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-X6xp9Y3w.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SiteNav() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "sticky top-0 z-40 w-full border-b border-white/5 bg-[color:var(--background)]/70 backdrop-blur-xl",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-16 max-w-7xl items-center justify-between px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4 text-white" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-semibold tracking-tight",
							children: "Sentinel"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "ml-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground",
							children: "AI"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					className: "hidden items-center gap-7 text-sm text-muted-foreground md:flex",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							className: "hover:text-foreground",
							children: "Home"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/dashboard",
							className: "hover:text-foreground",
							children: "Dashboard"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/dashboard/analytics",
							className: "hover:text-foreground",
							children: "Analytics"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "#docs",
							className: "hover:text-foreground",
							children: "Documentation"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
							href: "#about",
							className: "hover:text-foreground",
							children: "About"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						className: "rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-sm hover:bg-white/10",
						children: "Login"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/register",
						className: "rounded-lg bg-[image:var(--gradient-primary)] px-3.5 py-1.5 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110",
						children: "Get started"
					})]
				})
			]
		})
	});
}
function Landing() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SiteNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "relative overflow-hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NetworkBackdrop, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 pt-20 pb-24 md:pt-28 md:pb-32 lg:grid-cols-12 lg:gap-10",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
						initial: {
							opacity: 0,
							y: 14
						},
						animate: {
							opacity: 1,
							y: 0
						},
						transition: { duration: .6 },
						className: "lg:col-span-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground backdrop-blur",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" }), "Live inference · v4.2 · 12ms p95"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
								className: "text-balance text-5xl font-bold leading-[1.02] tracking-tight md:text-[64px]",
								children: [
									"Stop fraud before",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "gradient-text",
										children: "it reaches you."
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-6 max-w-xl text-lg text-muted-foreground",
								children: [
									"Real-time transaction analysis in ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium text-foreground",
										children: "under 12 milliseconds"
									}),
									". One API call, instant verdict, zero friction for real customers. Drop it in today, stop the bleeding tomorrow."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-9 flex flex-wrap items-center gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/register",
									className: "group inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] transition hover:brightness-110",
									children: ["Start building ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5" })]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: "/dashboard",
									className: "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "h-3.5 w-3.5" }), " Watch live demo"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-12 border-t border-white/5 pt-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-3 text-[11px] uppercase tracking-[0.18em] text-muted-foreground",
									children: "Stops at the edge"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-2",
									children: [
										"Card testing",
										"Account takeover",
										"OTP abuse",
										"Promo abuse",
										"Bot signups",
										"SMS pumping"
									].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-muted-foreground",
										children: t
									}, t))
								})]
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
						initial: {
							opacity: 0,
							y: 22,
							scale: .98
						},
						animate: {
							opacity: 1,
							y: 0,
							scale: 1
						},
						transition: {
							duration: .7,
							delay: .15,
							ease: [
								.22,
								1,
								.36,
								1
							]
						},
						className: "lg:col-span-6",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DashboardMock, {})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "relative border-t border-white/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-7xl px-6 py-24",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-12 max-w-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--cyan)]",
								children: "Platform"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-3xl font-semibold tracking-tight md:text-4xl",
								children: "Built for security teams that can't afford to blink."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-muted-foreground",
								children: "End-to-end tooling from ingestion to explainable decisions, wired for the speed and scale of modern card networks."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3",
						children: features.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
							initial: {
								opacity: 0,
								y: 10
							},
							whileInView: {
								opacity: 1,
								y: 0
							},
							viewport: {
								once: true,
								margin: "-60px"
							},
							transition: {
								duration: .4,
								delay: i * .05
							},
							className: "glass group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-white/20",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mb-4 grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)]/20 ring-1 ring-white/10",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(f.icon, { className: "h-5 w-5 text-[color:var(--cyan)]" })
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-medium",
									children: f.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1.5 text-sm text-muted-foreground",
									children: f.desc
								})
							]
						}, f.title))
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "docs",
				className: "relative border-t border-white/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto max-w-7xl px-6 py-24",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-12 max-w-2xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--cyan)]",
								children: "02 · How it works"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-3xl font-semibold tracking-tight md:text-4xl",
								children: "From one API call to catching fraud in five minutes."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 text-muted-foreground",
								children: "No agents, no sidecars, no heavy review tooling. Three steps and you're on the critical path."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "grid gap-4 md:grid-cols-4",
						children: steps.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.li, {
							initial: {
								opacity: 0,
								y: 10
							},
							whileInView: {
								opacity: 1,
								y: 0
							},
							viewport: { once: true },
							transition: {
								duration: .4,
								delay: i * .08
							},
							className: "glass relative rounded-2xl p-6",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mb-4 text-[11px] tracking-[0.18em] text-muted-foreground",
									children: ["STEP ", String(i + 1).padStart(2, "0")]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(s.icon, { className: "mb-3 h-5 w-5 text-[color:var(--purple)]" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-medium",
									children: s.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1.5 text-sm text-muted-foreground",
									children: s.desc
								})
							]
						}, s.title))
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				id: "about",
				className: "relative border-t border-white/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mx-auto max-w-7xl px-6 py-24",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "glass-strong relative overflow-hidden rounded-3xl p-10 md:p-14",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[color:var(--primary)]/30 blur-3xl" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-[color:var(--purple)]/25 blur-3xl" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-2xl font-semibold md:text-3xl",
									children: "Explore the live demo."
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 max-w-lg text-muted-foreground",
									children: "Simulate transactions from the customer portal, watch them flow into the analyst dashboard, and observe adaptive OTP verification in action."
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/register",
										className: "rounded-xl bg-[image:var(--gradient-primary)] px-5 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110",
										children: "Simulate a transaction"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
										to: "/dashboard",
										className: "rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm hover:bg-white/10",
										children: "Analyst dashboard"
									})]
								})]
							})
						]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-white/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground md:flex-row",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						"© ",
						(/* @__PURE__ */ new Date()).getFullYear(),
						" Sentinel — AI Fraud Detection Platform"
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: "Demo environment · Do not use with production card data" })]
				})
			})
		]
	});
}
var features = [
	{
		icon: Cpu,
		title: "Real-time inference",
		desc: "Sub-20ms fraud scores from a gradient-boosted ensemble tuned on billions of transactions."
	},
	{
		icon: MapPin,
		title: "Geospatial signals",
		desc: "Distance-from-home, velocity checks and terminal risk propagation baked in."
	},
	{
		icon: Lock,
		title: "Adaptive OTP",
		desc: "Suspicious transactions trigger step-up verification via Twilio Verify — not hard blocks."
	},
	{
		icon: ChartColumn,
		title: "Explainable decisions",
		desc: "SHAP-based feature contributions surfaced with every prediction."
	},
	{
		icon: Bell,
		title: "Live alerting",
		desc: "Priority-ranked alerts for hotspots, terminal drift and unusual customer behaviour."
	},
	{
		icon: ChartLine,
		title: "Enterprise analytics",
		desc: "Model drift, fraud rate cohorts and OTP correction dashboards for auditors."
	}
];
var steps = [
	{
		icon: Activity,
		title: "Ingest",
		desc: "Transactions stream in with terminal, amount and location metadata."
	},
	{
		icon: Zap,
		title: "Feature engineer",
		desc: "Rolling stats, distance, night-flag and terminal drift computed in-flight."
	},
	{
		icon: ShieldCheck,
		title: "Predict",
		desc: "Model returns probability, confidence and top feature contributions."
	},
	{
		icon: CircleCheck,
		title: "Verify",
		desc: "Adaptive OTP step-up for edge cases; final decision logged for audit."
	}
];
var FLAGS = [
	"🇬🇧",
	"🇺🇸",
	"🇩🇪",
	"🇧🇷",
	"🇯🇵",
	"🇫🇷",
	"🇮🇳",
	"🇨🇦",
	"🇦🇺",
	"🇳🇱"
];
var PATHS = [
	{
		path: "/login",
		verdictBias: "allow"
	},
	{
		path: "/payment",
		verdictBias: "block"
	},
	{
		path: "/signup",
		verdictBias: "allow"
	},
	{
		path: "/otp",
		verdictBias: "alert"
	},
	{
		path: "/checkout",
		verdictBias: "allow"
	}
];
function timeString(d = /* @__PURE__ */ new Date()) {
	return d.toTimeString().slice(0, 8);
}
function makeRow(id) {
	const p = PATHS[Math.floor(Math.random() * PATHS.length)];
	const r = Math.random();
	const verdict = r < .62 ? "allow" : r < .85 ? p.verdictBias === "alert" ? "alert" : "block" : "alert";
	return {
		id,
		time: timeString(),
		verdict,
		flag: FLAGS[Math.floor(Math.random() * FLAGS.length)],
		method: "POST",
		path: p.path,
		ms: (.7 + Math.random() * 1.4).toFixed(1)
	};
}
function DashboardMock() {
	const [rows, setRows] = (0, import_react.useState)(() => Array.from({ length: 5 }).map((_, i) => makeRow(1e3 - i)));
	const [counter, setCounter] = (0, import_react.useState)(12481);
	(0, import_react.useEffect)(() => {
		const id = setInterval(() => {
			setRows((prev) => [makeRow(prev[0].id + 1), ...prev].slice(0, 5));
			setCounter((c) => c + Math.floor(3 + Math.random() * 12));
		}, 1600);
		return () => clearInterval(id);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass-strong rounded-2xl p-3 shadow-[var(--shadow-glow)]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 border-b border-white/5 px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--danger)]/70" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--warning)]/70" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--success)]/70" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-3 flex items-center gap-1.5 rounded-md border border-white/5 bg-black/30 px-2 py-0.5 text-[11px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-3 w-3" }),
							" sentinel.ai ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-white/30",
								children: "/"
							}),
							" dashboard"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-3 pb-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-xl border border-white/5 bg-black/30 p-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Donut, { value: 93 }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-center justify-between",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
										children: "Fraud blocked / 24h"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--success)]/30 bg-[color:var(--success)]/10 px-2 py-0.5 text-[10px] text-[color:var(--success)]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" }), " LIVE"]
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-1 flex items-baseline gap-1.5",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
										initial: {
											opacity: 0,
											y: -4
										},
										animate: {
											opacity: 1,
											y: 0
										},
										transition: { duration: .25 },
										className: "text-3xl font-semibold tracking-tight tabular-nums",
										children: counter.toLocaleString()
									}, counter), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-xs text-muted-foreground",
										children: "requests"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-0.5 text-[11px] text-muted-foreground",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[color:var(--success)]",
										children: "↑ 14%"
									}), " vs yesterday · 2.8ms avg latency"]
								})
							]
						})]
					})
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-3 px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniKPI, {
					label: "p99 latency",
					tag: "SLA",
					value: "2.8",
					unit: "ms",
					delta: "-0.3ms",
					tone: "cyan",
					trend: "down"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniKPI, {
					label: "Block rate",
					tag: "7d",
					value: "18",
					unit: "%",
					delta: "+2.1pp",
					tone: "danger",
					trend: "up"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "p-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl border border-white/5 bg-black/30",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-white/5 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Live verdict stream" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "inline-flex items-center gap-1.5 text-[color:var(--success)] normal-case tracking-normal",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--success)]" }), " streaming"]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "divide-y divide-white/5 font-mono text-[11px]",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnimatePresence, {
							initial: false,
							children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.li, {
								layout: true,
								initial: {
									opacity: 0,
									y: -8,
									backgroundColor: "rgba(99,132,255,0.08)"
								},
								animate: {
									opacity: 1,
									y: 0,
									backgroundColor: "rgba(0,0,0,0)"
								},
								exit: { opacity: 0 },
								transition: { duration: .35 },
								className: "flex items-center gap-2 px-3 py-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-16 text-muted-foreground",
										children: r.time
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerdictBadge, { v: r.verdict }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "w-4 text-center",
										children: r.flag
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-muted-foreground",
										children: r.method
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "truncate",
										children: r.path
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "ml-auto tabular-nums text-muted-foreground",
										children: [r.ms, "ms"]
									})
								]
							}, r.id))
						})
					})]
				})
			})
		]
	});
}
function VerdictBadge({ v }) {
	const map = {
		allow: {
			c: "var(--success)",
			label: "allow"
		},
		block: {
			c: "var(--danger)",
			label: "block"
		},
		alert: {
			c: "var(--warning)",
			label: "alert"
		}
	}[v];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "inline-flex w-14 justify-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider",
		style: {
			color: map.c,
			borderColor: `color-mix(in oklab, ${map.c} 40%, transparent)`,
			background: `color-mix(in oklab, ${map.c} 10%, transparent)`
		},
		children: map.label
	});
}
function Donut({ value }) {
	const r = 22;
	const c = 2 * Math.PI * r;
	const off = c - value / 100 * c;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-16 w-16 shrink-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: "0 0 60 60",
			className: "h-full w-full -rotate-90",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: "30",
					cy: "30",
					r,
					stroke: "rgba(255,255,255,0.08)",
					strokeWidth: "6",
					fill: "none"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.circle, {
					cx: "30",
					cy: "30",
					r,
					stroke: "url(#donutGrad)",
					strokeWidth: "6",
					strokeLinecap: "round",
					fill: "none",
					strokeDasharray: c,
					initial: { strokeDashoffset: c },
					animate: { strokeDashoffset: off },
					transition: {
						duration: 1.4,
						ease: [
							.22,
							1,
							.36,
							1
						]
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
					id: "donutGrad",
					x1: "0",
					x2: "1",
					y1: "0",
					y2: "1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "0%",
						stopColor: "#60A5FA"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "100%",
						stopColor: "#A78BFA"
					})]
				}) })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "absolute inset-0 grid place-items-center text-sm font-semibold",
			children: [value, "%"]
		})]
	});
}
function MiniKPI({ label, tag, value, unit, delta, tone, trend }) {
	const stroke = tone === "danger" ? "#EF4444" : "#60A5FA";
	const fill = tone === "danger" ? "rgba(239,68,68,0.18)" : "rgba(96,165,250,0.22)";
	const deltaColor = trend === "down" ? "var(--success)" : "var(--danger)";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-white/5 bg-black/30 p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5",
					children: tag
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex items-baseline gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-2xl font-semibold tabular-nums",
						children: value
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-xs text-muted-foreground",
						children: unit
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "ml-auto rounded px-1.5 py-0.5 text-[10px]",
						style: {
							color: deltaColor,
							background: `color-mix(in oklab, ${deltaColor} 12%, transparent)`
						},
						children: delta
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, {
				stroke,
				fill,
				seed: tone === "danger" ? 4 : 1,
				trend
			})
		]
	});
}
function Sparkline({ stroke, fill, seed, trend }) {
	const d = (0, import_react.useMemo)(() => {
		const n = 28;
		const arr = [];
		let y = 24;
		for (let i = 0; i < n; i++) {
			const drift = trend === "up" ? -.35 : .35;
			const pseudoRandom = Math.sin(i * 12.9898 + seed * 78.233) * .5;
			y += Math.sin((i + seed) / 2.2) * 3 + pseudoRandom + drift;
			y = Math.max(6, Math.min(34, y));
			arr.push({
				x: i / (n - 1) * 100,
				y
			});
		}
		return arr;
	}, [seed, trend]).map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 100 40",
		preserveAspectRatio: "none",
		className: "mt-2 h-10 w-full",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.path, {
			d: `${d} L 100 40 L 0 40 Z`,
			fill,
			initial: { opacity: 0 },
			animate: { opacity: 1 },
			transition: {
				duration: .6,
				delay: .2
			}
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.path, {
			d,
			fill: "none",
			stroke,
			strokeWidth: "1.4",
			initial: { pathLength: 0 },
			animate: { pathLength: 1 },
			transition: {
				duration: 1.4,
				ease: "easeOut"
			}
		})]
	});
}
//#endregion
export { Landing as component };
