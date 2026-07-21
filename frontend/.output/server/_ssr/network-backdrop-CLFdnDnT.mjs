import { a as __toESM } from "../_runtime.mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/network-backdrop-CLFdnDnT.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function NetworkBackdrop() {
	const canvasRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		let raf = 0;
		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			canvas.width = canvas.offsetWidth * dpr;
			canvas.height = canvas.offsetHeight * dpr;
			ctx.scale(dpr, dpr);
		};
		resize();
		window.addEventListener("resize", resize);
		const N = 60;
		const nodes = Array.from({ length: N }).map(() => ({
			x: Math.random() * canvas.offsetWidth,
			y: Math.random() * canvas.offsetHeight,
			vx: (Math.random() - .5) * .3,
			vy: (Math.random() - .5) * .3
		}));
		const tick = () => {
			const w = canvas.offsetWidth;
			const h = canvas.offsetHeight;
			ctx.clearRect(0, 0, w, h);
			for (const n of nodes) {
				n.x += n.vx;
				n.y += n.vy;
				if (n.x < 0 || n.x > w) n.vx *= -1;
				if (n.y < 0 || n.y > h) n.vy *= -1;
			}
			for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
				const a = nodes[i], b = nodes[j];
				const dx = a.x - b.x, dy = a.y - b.y;
				const d = Math.hypot(dx, dy);
				if (d < 140) {
					ctx.strokeStyle = `rgba(99, 132, 255, ${(1 - d / 140) * .25})`;
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(a.x, a.y);
					ctx.lineTo(b.x, b.y);
					ctx.stroke();
				}
			}
			for (const n of nodes) {
				ctx.fillStyle = "rgba(140, 170, 255, 0.7)";
				ctx.beginPath();
				ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
				ctx.fill();
			}
			raf = requestAnimationFrame(tick);
		};
		tick();
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("resize", resize);
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-0 overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 grid-bg opacity-40" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "absolute inset-0",
				style: { backgroundImage: "var(--gradient-mesh)" }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
				className: "absolute -left-24 top-20 h-72 w-72 rounded-full bg-[color:var(--primary)]/25 blur-3xl",
				animate: { y: [
					0,
					20,
					0
				] },
				transition: {
					duration: 8,
					repeat: Infinity,
					ease: "easeInOut"
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
				className: "absolute right-0 top-40 h-80 w-80 rounded-full bg-[color:var(--purple)]/20 blur-3xl",
				animate: { y: [
					0,
					-25,
					0
				] },
				transition: {
					duration: 10,
					repeat: Infinity,
					ease: "easeInOut"
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, {
				className: "absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[color:var(--cyan)]/15 blur-3xl",
				animate: { y: [
					0,
					15,
					0
				] },
				transition: {
					duration: 12,
					repeat: Infinity,
					ease: "easeInOut"
				}
			})
		]
	});
}
//#endregion
export { NetworkBackdrop as t };
