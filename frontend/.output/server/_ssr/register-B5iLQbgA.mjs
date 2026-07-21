import { a as __toESM } from "../_runtime.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { d as setToken, l as setCustomer, t as authApi } from "./api-lzJxAJXb.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { g as Link, v as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { D as Lock, K as CircleCheck, O as LoaderCircle, W as Copy, b as Phone, o as User, p as ShieldCheck, w as MapPin } from "../_libs/lucide-react.mjs";
import { t as NetworkBackdrop } from "./network-backdrop-CLFdnDnT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/register-B5iLQbgA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RegisterPage() {
	const navigate = useNavigate();
	const [step, setStep] = (0, import_react.useState)("form");
	const [fullName, setFullName] = (0, import_react.useState)("");
	const [phone, setPhone] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [coords, setCoords] = (0, import_react.useState)(null);
	const [cardNumber, setCardNumber] = (0, import_react.useState)("");
	const submit = async (e) => {
		e.preventDefault();
		if (!phone || password.length < 6) {
			toast.error("Enter a valid phone and a 6+ character password");
			return;
		}
		setStep("locating");
		const c = await new Promise((resolve) => {
			if (!("geolocation" in navigator)) {
				resolve({
					lat: 40.7128,
					lng: -74.006
				});
				return;
			}
			navigator.geolocation.getCurrentPosition((p) => resolve({
				lat: p.coords.latitude,
				lng: p.coords.longitude
			}), () => resolve({
				lat: 40.7128,
				lng: -74.006
			}), { timeout: 5e3 });
		});
		setCoords(c);
		let formattedPhone = phone.trim();
		if (!formattedPhone.startsWith("+")) formattedPhone = "+" + formattedPhone;
		try {
			const res = await authApi.register({
				phone_number: formattedPhone,
				password,
				full_name: fullName || void 0,
				lat: c.lat,
				lon: c.lng
			});
			setToken(res.token);
			setCustomer(res);
			setCardNumber(String(res.customer_id));
			try {
				localStorage.setItem("sentinel:lastCardNumber", String(res.customer_id));
				localStorage.setItem("sentinel:cardNumber", String(res.customer_id));
			} catch {}
			setStep("done");
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
			toast.error(msg);
			setStep("form");
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
			}), step !== "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.form, {
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
						children: "Create your card"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Register with your phone number. We'll issue a Customer ID that acts as your card number."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-6 block text-xs text-muted-foreground",
						children: "Full name (optional)"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(User, { className: "h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: fullName,
							onChange: (e) => setFullName(e.target.value),
							placeholder: "Alex Morgan",
							className: "w-full bg-transparent py-3 text-sm outline-none"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						className: "mt-4 block text-xs text-muted-foreground",
						children: "Phone number"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, { className: "h-4 w-4 text-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: phone,
							onChange: (e) => setPhone(e.target.value),
							placeholder: "+1 555 010 4477",
							className: "w-full bg-transparent py-3 text-sm outline-none",
							inputMode: "tel"
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
							placeholder: "6+ characters",
							className: "w-full bg-transparent py-3 text-sm outline-none"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-xs text-muted-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-3.5 w-3.5 text-[color:var(--cyan)]" }), "We'll capture your approximate location during signup for risk scoring."]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: step === "locating",
						className: "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110 disabled:opacity-70",
						children: step === "locating" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Locating…"] }) : "Create card"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-4 text-center text-xs text-muted-foreground",
						children: ["Already have a card? ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/login",
							className: "text-foreground hover:underline",
							children: "Sign in"
						})]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
				initial: {
					opacity: 0,
					scale: .98
				},
				animate: {
					opacity: 1,
					scale: 1
				},
				className: "glass-strong rounded-2xl p-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--success)]/15 ring-1 ring-[color:var(--success)]/30",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, { className: "h-6 w-6 text-[color:var(--success)]" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mt-4 text-xl font-semibold",
						children: "You're all set"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Your new card has been provisioned. Use the number below to sign in."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 rounded-xl border border-white/10 bg-black/30 p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted-foreground",
								children: "Your Card Number (Customer ID)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-1 flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "font-mono text-2xl tracking-wider gradient-text",
									children: cardNumber
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => {
										navigator.clipboard.writeText(cardNumber);
										toast.success("Copied");
									},
									className: "rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "h-3.5 w-3.5" })
								})]
							}),
							coords && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-3 flex items-center gap-2 text-xs text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "h-3.5 w-3.5" }),
									"Location captured: ",
									coords.lat.toFixed(3),
									", ",
									coords.lng.toFixed(3)
								]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => navigate({ to: "/login" }),
						className: "mt-6 w-full rounded-xl bg-[image:var(--gradient-primary)] px-4 py-3 text-sm font-medium text-white shadow-[var(--shadow-glow)] hover:brightness-110",
						children: "Continue to sign in"
					})
				]
			})]
		})]
	});
}
//#endregion
export { RegisterPage as component };
