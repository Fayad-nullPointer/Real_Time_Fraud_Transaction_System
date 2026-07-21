import { a as __toESM } from "../_runtime.mjs";
import { a as getAdminToken, s as getToken } from "./api-lzJxAJXb.mjs";
import { r as require_react } from "../_libs/react+tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/useAdminWs-CNYccNIn.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function getWsBase() {
	return "ws://localhost:8005";
}
function useAdminWs(onEvent) {
	const [connected, setConnected] = (0, import_react.useState)(false);
	const wsRef = (0, import_react.useRef)(null);
	const onEventRef = (0, import_react.useRef)(onEvent);
	(0, import_react.useEffect)(() => {
		onEventRef.current = onEvent;
	}, [onEvent]);
	const connect = (0, import_react.useCallback)(() => {
		const token = getAdminToken() ?? getToken();
		if (!token) return;
		const ws = new WebSocket(`${getWsBase()}/api/dashboard/ws?token=${token}`);
		wsRef.current = ws;
		ws.onopen = () => setConnected(true);
		ws.onclose = () => {
			setConnected(false);
			setTimeout(connect, 3e3);
		};
		ws.onerror = () => ws.close();
		ws.onmessage = (e) => {
			try {
				const ev = JSON.parse(e.data);
				onEventRef.current?.(ev);
			} catch {}
		};
	}, []);
	(0, import_react.useEffect)(() => {
		connect();
		return () => wsRef.current?.close();
	}, [connect]);
	return connected;
}
//#endregion
export { useAdminWs as t };
