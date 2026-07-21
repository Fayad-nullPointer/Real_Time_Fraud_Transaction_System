//#region node_modules/.nitro/vite/services/ssr/assets/api-lzJxAJXb.js
var BASE = "";
var isBrowser = typeof window !== "undefined";
var getAdminToken = () => isBrowser ? localStorage.getItem("sentinel:admin_token") || localStorage.getItem("sentinel:token") : null;
var setAdminToken = (t) => {
	if (isBrowser) {
		localStorage.setItem("sentinel:admin_token", t);
		localStorage.setItem("sentinel:token", t);
	}
};
var clearAdminToken = () => {
	if (isBrowser) localStorage.removeItem("sentinel:admin_token");
};
var getCustomerToken = () => isBrowser ? localStorage.getItem("sentinel:customer_token") || localStorage.getItem("sentinel:token") : null;
var setCustomerToken = (t) => {
	if (isBrowser) {
		localStorage.setItem("sentinel:customer_token", t);
		localStorage.setItem("sentinel:token", t);
	}
};
var clearCustomerToken = () => {
	if (isBrowser) {
		localStorage.removeItem("sentinel:customer_token");
		localStorage.removeItem("sentinel:customer");
	}
};
var getToken = () => getCustomerToken() || getAdminToken();
var setToken = (t) => {
	setCustomerToken(t);
	setAdminToken(t);
};
var getCustomer = () => isBrowser ? JSON.parse(localStorage.getItem("sentinel:customer") ?? "null") : null;
var setCustomer = (c) => {
	if (isBrowser) localStorage.setItem("sentinel:customer", JSON.stringify(c));
};
async function apiFetch(path, options = {}, auth = false) {
	const headers = {
		"Content-Type": "application/json",
		...options.headers
	};
	if (auth) {
		const token = path.startsWith("/api/dashboard") ? getAdminToken() || getCustomerToken() : getCustomerToken() || getAdminToken();
		if (token) headers["Authorization"] = `Bearer ${token}`;
	}
	const response = await fetch(`${BASE}${path}`, {
		...options,
		headers
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.detail ?? "Request failed");
	return data;
}
var authApi = {
	login: (customer_id, password) => apiFetch("/api/auth/login", {
		method: "POST",
		body: JSON.stringify({
			customer_id,
			password
		})
	}),
	register: (body) => apiFetch("/api/auth/register", {
		method: "POST",
		body: JSON.stringify(body)
	}),
	me: () => apiFetch("/api/auth/me", {}, true),
	myState: () => apiFetch("/api/auth/me/state", {}, true),
	updateLocation: (lat, lon) => apiFetch("/api/auth/location", {
		method: "POST",
		body: JSON.stringify({
			lat,
			lon
		})
	}, true)
};
var txApi = {
	create: (body) => apiFetch("/api/transactions/create", {
		method: "POST",
		body: JSON.stringify(body)
	}, true),
	verify: (transaction_id, otp_code) => apiFetch("/api/transactions/verify", {
		method: "POST",
		body: JSON.stringify({
			transaction_id,
			otp_code
		})
	}, true),
	decline: (transaction_id) => apiFetch("/api/transactions/decline", {
		method: "POST",
		body: JSON.stringify({
			transaction_id,
			otp_code: "000000"
		})
	}, true),
	history: (limit = 20) => apiFetch(`/api/transactions/history?limit=${limit}`, {}, true)
};
var terminalApi = { list: () => apiFetch("/api/terminals", {}, false) };
var dashboardApi = {
	metrics: () => apiFetch("/api/dashboard/metrics", {}, true),
	transactions: (limit = 50, offset = 0) => apiFetch(`/api/dashboard/transactions?limit=${limit}&offset=${offset}`, {}, true),
	transactionDetail: (id) => apiFetch(`/api/dashboard/transactions/${id}`, {}, true),
	system: () => apiFetch("/api/dashboard/system", {}, true),
	customers: (limit = 200) => apiFetch(`/api/dashboard/customers?limit=${limit}`, {}, true),
	customerProfile: (id) => apiFetch(`/api/dashboard/customers/${id}`, {}, true),
	analyticsCharts: () => apiFetch("/api/dashboard/analytics/charts", {}, true),
	terminalStats: () => apiFetch("/api/dashboard/terminals/stats", {}, true),
	alerts: () => apiFetch("/api/dashboard/alerts", {}, true),
	fraudMap: () => apiFetch("/api/dashboard/fraud-map", {}, true),
	logs: (limit = 200, level = "") => apiFetch(`/api/dashboard/logs?limit=${limit}&level=${level}`, {}, true),
	reports: () => apiFetch("/api/dashboard/reports", {}, true)
};
//#endregion
export { getAdminToken as a, setAdminToken as c, setToken as d, terminalApi as f, dashboardApi as i, setCustomer as l, clearAdminToken as n, getCustomer as o, txApi as p, clearCustomerToken as r, getToken as s, authApi as t, setCustomerToken as u };
