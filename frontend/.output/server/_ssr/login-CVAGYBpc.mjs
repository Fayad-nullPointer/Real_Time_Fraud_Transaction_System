import { a as __toESM } from "../_runtime.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { c as setAdminToken, l as setCustomer, t as authApi, u as setCustomerToken } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { g as Link, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { D as Lock, H as CreditCard, O as LoaderCircle, p as ShieldCheck } from "../_libs/lucide-react.mjs";
import { t as NetworkBackdrop } from "./network-backdrop-CLFdnDnT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-CVAGYBpc.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function LoginPage() {
	const navigate = useNavigate();
	const [cardNumber, setCardNumber] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [loading, setLoading] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		try {
			const saved = localStorage.getItem("sentinel:lastCardNumber");
			if (saved) setCardNumber(saved);
		} catch {}
	}, []);
	const submit = async (e) => {
		e.preventDefault();
		if (!cardNumber || password.length < 6) {
			toast.error("Enter your card number and password");
			return;
		}
		const id = parseInt(cardNumber, 10);
		if (isNaN(id)) {
			toast.error("Card number must be a valid number");
			return;
		}
		setLoading(true);
		try {
			const res = await authApi.login(id, password);
			try {
				localStorage.setItem("sentinel:lastCardNumber", String(res.customer_id));
			} catch {}
			toast.success("Signed in");
			if (res.role === "admin") {
				setAdminToken(res.token);
				navigate({ to: "/dashboard" });
			} else {
				setCustomerToken(res.token);
				setCustomer(res);
				navigate({ to: "/pay" });
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Login failed. Please check your credentials.";
			toast.error(msg);
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-screen overflow-hidden",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NetworkBackdrop, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/",
				className: "mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid h-8 w-8 place-items-center rounded-lg bg-[image:var(--gradient-primary)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-4 w-4 text-white" })
				}), "Sentinel"]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.form, {
				initial: {
					opacity: 0,
					y: 10
				},
				animate: {
					opacity: 1,
					y: 0
				},
				onSubmit: submit,
				className: "glass-strong rounded-2xl p-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-semibold tracking-tight",
						children: "Welcome back"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Sign in with your card number."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-6 block text-xs text-muted-foreground",
						children: "Card Number (Customer ID)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, { className: "h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: cardNumber,
							onChange: (e) => setCardNumber(e.target.value),
							inputMode: "numeric",
							placeholder: "10000000",
							className: "w-full bg-transparent py-3 font-mono text-sm outline-none"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-4 block text-xs text-muted-foreground",
						children: "Password"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: password,
							onChange: (e) => setPassword(e.target.value),
							type: "password",
							placeholder: "••••••••",
							className: "w-full bg-transparent py-3 text-sm outline-none"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: loading,
						className: "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-70",
						children: loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Signing in…"] }) : "Sign in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-center text-xs text-muted-foreground",
						children: ["No card yet? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/register",
							className: "text-foreground hover:underline",
							children: "Register"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-center text-xs text-muted-foreground",
						children: ["Fraud analyst? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/dashboard",
							className: "text-foreground hover:underline",
							children: "Open dashboard"
						})]
					})
				]
			})]
		})]
	});
}
//#endregion
export { LoginPage as component };
