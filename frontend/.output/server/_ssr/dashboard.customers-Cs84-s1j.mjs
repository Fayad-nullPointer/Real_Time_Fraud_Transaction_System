import { a as __toESM } from "../_runtime.mjs";
import { i as dashboardApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { J as ChevronRight, O as LoaderCircle, Y as ChevronLeft, _ as Search, o as User } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/dashboard.customers-Cs84-s1j.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PAGE_SIZE = 20;
function CustomersPage() {
	const [customers, setCustomers] = (0, import_react.useState)([]);
	const [q, setQ] = (0, import_react.useState)("");
	const [page, setPage] = (0, import_react.useState)(1);
	const [selected, setSelected] = (0, import_react.useState)(null);
	const [profileDetail, setProfileDetail] = (0, import_react.useState)(null);
	const [loadingProfile, setLoadingProfile] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		dashboardApi.customers(500).then(setCustomers).catch(console.error);
	}, []);
	(0, import_react.useEffect)(() => {
		if (selected) {
			setLoadingProfile(true);
			dashboardApi.customerProfile(selected.customer_id).then((res) => {
				setProfileDetail(res);
				setLoadingProfile(false);
			}).catch(() => {
				setProfileDetail(null);
				setLoadingProfile(false);
			});
		} else setProfileDetail(null);
	}, [selected]);
	const filtered = customers.filter((c) => q ? c.customer_id.toString().includes(q) || c.location.toLowerCase().includes(q.toLowerCase()) || (c.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || c.phone_number.includes(q) : true);
	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pageView = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
	const startItem = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
	const endItem = Math.min(currentPage * PAGE_SIZE, filtered.length);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-end justify-between",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-2xl font-semibold tracking-tight",
				children: "Customers"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Profiles, risk scores, and empirical spending statistics."
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "h-3.5 w-3.5 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: q,
					onChange: (e) => {
						setQ(e.target.value);
						setPage(1);
					},
					placeholder: "Search ID, name, phone or city…",
					className: "w-64 bg-transparent py-1.5 text-xs outline-none"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-1 gap-4 lg:grid-cols-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "glass rounded-2xl p-4 lg:col-span-2 flex flex-col justify-between min-h-[580px]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-xs text-muted-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-white/5",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Customer"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Location"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Txns"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Avg Spend"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Risk Score"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: pageView.length > 0 ? pageView.map((c) => {
						const tone = c.risk_score > 70 ? "bg-[color:var(--danger)]" : c.risk_score > 40 ? "bg-[color:var(--warning)]" : "bg-[color:var(--success)]";
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							onClick: () => setSelected(c),
							className: `cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors ${selected?.customer_id === c.customer_id ? "bg-white/[0.06]" : ""}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2.5 pr-3 font-mono text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "font-semibold text-white",
										children: c.customer_id
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-[11px] text-muted-foreground",
										children: c.full_name ?? c.phone_number
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3 text-muted-foreground",
									children: c.location
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3 font-medium",
									children: c.total_txns
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2.5 pr-3",
									children: ["$", c.avg_amount.toFixed(2)]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2.5 pr-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
											className: "h-1.5 w-16 overflow-hidden rounded-full bg-white/5",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: `h-full ${tone}`,
												style: { width: `${c.risk_score}%` }
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-xs font-mono",
											children: c.risk_score
										})]
									})
								})
							]
						}, c.customer_id);
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						colSpan: 5,
						className: "py-8 text-center text-sm text-muted-foreground",
						children: "No customers match your search criteria."
					}) }) })]
				}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						"Showing ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-medium text-white",
							children: [
								startItem,
								"–",
								endItem
							]
						}),
						" of ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-white",
							children: filtered.length
						}),
						" customers"
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "mr-1",
								children: [
									"Page ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium text-white",
										children: currentPage
									}),
									" of ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium text-white",
										children: totalPages
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPage((p) => Math.max(1, p - 1)),
								disabled: currentPage === 1,
								className: "rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "h-4 w-4" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
								disabled: currentPage >= totalPages,
								className: "rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "h-4 w-4" })
							})
						]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "glass rounded-2xl p-5 min-h-[580px]",
				children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground uppercase tracking-wider font-semibold",
							children: "Customer Profile"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-full bg-cyan-500/10 p-2 text-cyan-400 border border-cyan-500/20",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "h-5 w-5" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "font-mono text-lg font-bold text-white",
								children: ["ID #", selected.customer_id]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-muted-foreground",
								children: [
									selected.full_name ?? selected.phone_number,
									" · ",
									selected.location
								]
							})] })]
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid grid-cols-2 gap-2 text-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Total Txns",
									value: String(selected.total_txns)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Avg Spend",
									value: `$${selected.avg_amount.toFixed(2)}`
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Terminals Used",
									value: String(selected.terminals_used)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Risk Score",
									value: `${selected.risk_score}/100`
								}),
								profileDetail?.mean_amount != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Hist. Mean Spend",
									value: `$${profileDetail.mean_amount.toFixed(2)}`
								}),
								profileDetail?.std_amount != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									label: "Spend Variance",
									value: `$${profileDetail.std_amount.toFixed(2)}`
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs uppercase tracking-wider text-muted-foreground font-semibold",
								children: "Recent Account Transactions"
							}), loadingProfile ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin text-cyan-400" }), " Fetching history..."]
							}) : profileDetail?.recent_transactions && profileDetail.recent_transactions.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "mt-2 space-y-1.5",
								children: profileDetail.recent_transactions.map((tx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "font-mono text-[11px] text-muted-foreground",
										children: [tx.transaction_id.slice(0, 12), "…"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "font-medium text-white",
										children: ["$", tx.tx_amount.toFixed(2)]
									})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "text-right",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: `inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${tx.status === "APPROVED" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : tx.status === "DECLINED" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`,
											children: tx.status
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "text-[10px] text-muted-foreground mt-0.5",
											children: [(tx.fraud_probability * 100).toFixed(0), "% prob"]
										})]
									})]
								}, tx.transaction_id))
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 text-xs text-muted-foreground py-3",
								children: "No recent transactions recorded for this customer."
							})]
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid h-full place-items-center text-sm text-muted-foreground",
					children: customers.length === 0 ? "Loading customers…" : "Select a customer from the table to view baseline details"
				})
			})]
		})]
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-white/5 bg-white/[0.02] p-2.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-[10px] uppercase tracking-wider text-muted-foreground font-medium",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 font-semibold text-white text-sm",
			children: value
		})]
	});
}
//#endregion
export { CustomersPage as component };
