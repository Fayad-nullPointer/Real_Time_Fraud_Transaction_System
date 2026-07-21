globalThis.__nitro_main__ = import.meta.url;
import { a as FastResponse, n as HTTPError, r as defineLazyEventHandler, t as H3Core } from "./_libs/h3+rou3+srvx.mjs";
import { t as HookableCore } from "./_libs/hookable.mjs";
//#region #nitro-vite-setup
function lazyService(loader) {
	let promise, mod;
	return { fetch(req) {
		if (mod) return mod.fetch(req);
		if (!promise) promise = loader().then((_mod) => mod = _mod.default || _mod);
		return promise.then((mod) => mod.fetch(req));
	} };
}
var services = { ["ssr"]: lazyService(() => import("./_ssr/ssr.mjs")) };
globalThis.__nitro_vite_envs__ = services;
//#endregion
//#region #nitro/virtual/public-assets-data
var public_assets_data_default = {
	"/favicon.ico": {
		"type": "image/vnd.microsoft.icon",
		"etag": "\"4f95-3RXc3p2mhEAs1WBwaIvE0Y0uu0Y\"",
		"mtime": "2026-07-21T06:49:07.300Z",
		"size": 20373,
		"path": "../public/favicon.ico"
	},
	"/assets/activity-CS2KhuZ1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ea-fP8wb9lu5nl00hZSrQMpiSbV/og\"",
		"mtime": "2026-07-21T16:34:16.486Z",
		"size": 234,
		"path": "../public/assets/activity-CS2KhuZ1.js"
	},
	"/assets/api-DLEIEpkB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"acf-8NsQs+3aUXouv5M62k8usfIsvtQ\"",
		"mtime": "2026-07-21T16:34:16.487Z",
		"size": 2767,
		"path": "../public/assets/api-DLEIEpkB.js"
	},
	"/assets/AnimatePresence-8OJ2F8Gp.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"104f-0R3CuUaDq+I+K/cKJRvIcFRs37g\"",
		"mtime": "2026-07-21T16:34:16.466Z",
		"size": 4175,
		"path": "../public/assets/AnimatePresence-8OJ2F8Gp.js"
	},
	"/assets/arrow-right-DLT_kna4.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a5-JPrlxMQeDYOdvd4M/FM6CUpMG2c\"",
		"mtime": "2026-07-21T16:34:16.487Z",
		"size": 165,
		"path": "../public/assets/arrow-right-DLT_kna4.js"
	},
	"/assets/chart-line-Bsb_Aqd9.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5-2tO+i8k2ZcNz6r2lfCDd2z5rpbc\"",
		"mtime": "2026-07-21T16:34:16.505Z",
		"size": 421,
		"path": "../public/assets/chart-line-Bsb_Aqd9.js"
	},
	"/assets/chevron-right-BpwPuw1F.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"82-O/DkcEMSXwiP7MHbWo6HGO6YMBw\"",
		"mtime": "2026-07-21T16:34:16.508Z",
		"size": 130,
		"path": "../public/assets/chevron-right-BpwPuw1F.js"
	},
	"/assets/AreaChart-DjEUe49r.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5dac1-nb69EjRbWOlF5mFP0o/Wtt2iug4\"",
		"mtime": "2026-07-21T16:34:16.469Z",
		"size": 383681,
		"path": "../public/assets/AreaChart-DjEUe49r.js"
	},
	"/assets/chevron-left-DXlQYZiA.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"82-dvZSvwXB3qaoL/HLcHFGIRw+DMA\"",
		"mtime": "2026-07-21T16:34:16.506Z",
		"size": 130,
		"path": "../public/assets/chevron-left-DXlQYZiA.js"
	},
	"/assets/circle-check-big-CX9Np_1e.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c2-uuDCZ+Y4ai3QgiTKF+K6pLj6Qvc\"",
		"mtime": "2026-07-21T16:34:16.590Z",
		"size": 194,
		"path": "../public/assets/circle-check-big-CX9Np_1e.js"
	},
	"/assets/circle-check-DwJfZhmK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b2-8nYtvF4bI1K4iYX0ZYOyejsYfGA\"",
		"mtime": "2026-07-21T16:34:16.586Z",
		"size": 178,
		"path": "../public/assets/circle-check-DwJfZhmK.js"
	},
	"/assets/circle-question-mark-BGK0BGGi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"f8-jTok2T33U6W4wlZ8EFGUv0AtvJ8\"",
		"mtime": "2026-07-21T16:34:16.590Z",
		"size": 248,
		"path": "../public/assets/circle-question-mark-BGK0BGGi.js"
	},
	"/assets/cpu-BFTfoQrV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"282-DfShnK6T1CCx2q3+9D6823mSMsg\"",
		"mtime": "2026-07-21T16:34:16.591Z",
		"size": 642,
		"path": "../public/assets/cpu-BFTfoQrV.js"
	},
	"/assets/createLucideIcon-CHL8iLJY.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"4ab-mQXHw8iw8YMp9jPS1l8d5nLOdUY\"",
		"mtime": "2026-07-21T16:34:16.593Z",
		"size": 1195,
		"path": "../public/assets/createLucideIcon-CHL8iLJY.js"
	},
	"/assets/credit-card-ahA8D7Tr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"cf-HaJq//yN9YSP6/vpcyd8LNYDDW4\"",
		"mtime": "2026-07-21T16:34:16.594Z",
		"size": 207,
		"path": "../public/assets/credit-card-ahA8D7Tr.js"
	},
	"/assets/dashboard-C2YjfQwX.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a0e-j0TEZKmXapTfIdTPdAQyn0s+Dts\"",
		"mtime": "2026-07-21T16:34:16.595Z",
		"size": 6670,
		"path": "../public/assets/dashboard-C2YjfQwX.js"
	},
	"/assets/dashboard.alerts-BoP9vQJG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"86f-febGr18xJlhHJhwKgpbPh2aSkCI\"",
		"mtime": "2026-07-21T16:34:16.597Z",
		"size": 2159,
		"path": "../public/assets/dashboard.alerts-BoP9vQJG.js"
	},
	"/assets/dashboard.analytics-DG0Dyio2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"b488-WrzcnbVBdudhmoU5sMt2di2s0JI\"",
		"mtime": "2026-07-21T16:34:16.597Z",
		"size": 46216,
		"path": "../public/assets/dashboard.analytics-DG0Dyio2.js"
	},
	"/assets/dashboard.customers-DPrORHiU.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"21af-K/pwqMWLYyY6XHHsfFI+RKK6QF4\"",
		"mtime": "2026-07-21T16:34:16.598Z",
		"size": 8623,
		"path": "../public/assets/dashboard.customers-DPrORHiU.js"
	},
	"/assets/dashboard.index-DLR6Pd4Q.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3550-g9tYXeCgntiJCGDYlY4vEKcJHxg\"",
		"mtime": "2026-07-21T16:34:16.599Z",
		"size": 13648,
		"path": "../public/assets/dashboard.index-DLR6Pd4Q.js"
	},
	"/assets/dashboard.live-DvGFj9Rd.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"3b17-ynQ3jDrswXTShD0LnvAqKFXB5BY\"",
		"mtime": "2026-07-21T16:34:16.599Z",
		"size": 15127,
		"path": "../public/assets/dashboard.live-DvGFj9Rd.js"
	},
	"/assets/dashboard.logs-B63mStkF.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"16a1-hFXMmsHl3v1L+Qy7f4HtHRkTDAs\"",
		"mtime": "2026-07-21T16:34:16.600Z",
		"size": 5793,
		"path": "../public/assets/dashboard.logs-B63mStkF.js"
	},
	"/assets/dashboard.reports-dCEu7fwo.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2227-Eau/bP4cIgtCtnzwv/kv5ULc7RU\"",
		"mtime": "2026-07-21T16:34:16.601Z",
		"size": 8743,
		"path": "../public/assets/dashboard.reports-dCEu7fwo.js"
	},
	"/assets/dashboard.system-ZC-YZFI5.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1933-Haa69uHyyMX0oAbjqIgGNQDW7Ks\"",
		"mtime": "2026-07-21T16:34:16.602Z",
		"size": 6451,
		"path": "../public/assets/dashboard.system-ZC-YZFI5.js"
	},
	"/assets/dashboard.terminals-Cx4uV8DV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a6a-dbsqkc72V0jQHaW4WVzXRhU4u0I\"",
		"mtime": "2026-07-21T16:34:16.604Z",
		"size": 2666,
		"path": "../public/assets/dashboard.terminals-Cx4uV8DV.js"
	},
	"/assets/FeatureProfileViewer-CqJ25bDf.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"277b-Necurmz1OvcidEc6nwn4mAOuXQI\"",
		"mtime": "2026-07-21T16:34:16.480Z",
		"size": 10107,
		"path": "../public/assets/FeatureProfileViewer-CqJ25bDf.js"
	},
	"/assets/dollar-sign-Br2ASyp7.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"db-ozkPVrJ7HrFsAZHgKxPdR9N6Etc\"",
		"mtime": "2026-07-21T16:34:16.654Z",
		"size": 219,
		"path": "../public/assets/dollar-sign-Br2ASyp7.js"
	},
	"/assets/file-text-B0tK058-.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"181-haH9G93hdLnTXSW6Si5JVssZ12I\"",
		"mtime": "2026-07-21T16:34:16.656Z",
		"size": 385,
		"path": "../public/assets/file-text-B0tK058-.js"
	},
	"/assets/GoogleTerminalMap-BT3e0hhC.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"262c2-aCfjdoI7oombqLdC47ACSXkpSTA\"",
		"mtime": "2026-07-21T16:34:16.483Z",
		"size": 156354,
		"path": "../public/assets/GoogleTerminalMap-BT3e0hhC.js"
	},
	"/assets/jsx-runtime-DnlWeMvz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"21db-DyRXgHJbgwJH/PAr3ueX5dgg7Yc\"",
		"mtime": "2026-07-21T16:34:16.676Z",
		"size": 8667,
		"path": "../public/assets/jsx-runtime-DnlWeMvz.js"
	},
	"/assets/loader-circle-BEjpNePl.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"90-etocJgpTkj7wBJLaw+ZeUT0Eshk\"",
		"mtime": "2026-07-21T16:34:16.707Z",
		"size": 144,
		"path": "../public/assets/loader-circle-BEjpNePl.js"
	},
	"/assets/layers-B2IW7ayi.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1a5-XaQFIm/m0GA1pRYmYdWVqzBOQAY\"",
		"mtime": "2026-07-21T16:34:16.706Z",
		"size": 421,
		"path": "../public/assets/layers-B2IW7ayi.js"
	},
	"/assets/log-out-Bzy6cd3u.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"e6-8rVMINCmNzod9bY5d+U01OOkD60\"",
		"mtime": "2026-07-21T16:34:16.708Z",
		"size": 230,
		"path": "../public/assets/log-out-Bzy6cd3u.js"
	},
	"/assets/map-pin-DDyqcN8m.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"103-bqo4YNp6JUuaMozLCSU/aw0hdrQ\"",
		"mtime": "2026-07-21T16:34:16.710Z",
		"size": 259,
		"path": "../public/assets/map-pin-DDyqcN8m.js"
	},
	"/assets/login-BieIOU1o.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"eb0-5CK+dqKjoXwUiiiyy91rPuAbv0s\"",
		"mtime": "2026-07-21T16:34:16.709Z",
		"size": 3760,
		"path": "../public/assets/login-BieIOU1o.js"
	},
	"/assets/pay-DNvFBZ-t.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"52a5-rqqR9DMpxQmMBNM4C77g821kR34\"",
		"mtime": "2026-07-21T16:34:16.713Z",
		"size": 21157,
		"path": "../public/assets/pay-DNvFBZ-t.js"
	},
	"/assets/index-F45aAMKB.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"5a749-hT7ZDehKyXLKZbCC6w+q4YuuDr8\"",
		"mtime": "2026-07-21T16:34:16.465Z",
		"size": 370505,
		"path": "../public/assets/index-F45aAMKB.js"
	},
	"/assets/phone-BsaamTgK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1f9-HGBBTcMVVVoh1pn0reUwavpXRB4\"",
		"mtime": "2026-07-21T16:34:16.719Z",
		"size": 505,
		"path": "../public/assets/phone-BsaamTgK.js"
	},
	"/assets/profile-Dy_7XlmK.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"2e0d-Oqx/hnWMCL2JNxriMjJ0Kg00/s4\"",
		"mtime": "2026-07-21T16:34:16.726Z",
		"size": 11789,
		"path": "../public/assets/profile-Dy_7XlmK.js"
	},
	"/assets/network-backdrop-CbT5KQnV.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"8fe-9AluKtQ3oIhGLmIBXHhoFD/0/sA\"",
		"mtime": "2026-07-21T16:34:16.712Z",
		"size": 2302,
		"path": "../public/assets/network-backdrop-CbT5KQnV.js"
	},
	"/assets/react-dom-DriRPPLg.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"dda-Oa1wKf/KHSM9SlgG7lpQE8MQ8ZU\"",
		"mtime": "2026-07-21T16:34:16.731Z",
		"size": 3546,
		"path": "../public/assets/react-dom-DriRPPLg.js"
	},
	"/assets/search-DeFcOENG.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"ae-7hTI9cM/eXc6TAPAnU8wT07N/oc\"",
		"mtime": "2026-07-21T16:34:16.738Z",
		"size": 174,
		"path": "../public/assets/search-DeFcOENG.js"
	},
	"/assets/proxy-BPfTbq1R.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"1d836-KKvPUqNL/OIsJuQ7TtAFtAX0X8M\"",
		"mtime": "2026-07-21T16:34:16.728Z",
		"size": 120886,
		"path": "../public/assets/proxy-BPfTbq1R.js"
	},
	"/assets/register-R8Dw0SE2.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"18e1-AVwPUm99dbLOOVbkHlTxatJ6mr0\"",
		"mtime": "2026-07-21T16:34:16.736Z",
		"size": 6369,
		"path": "../public/assets/register-R8Dw0SE2.js"
	},
	"/assets/shield-alert-CeVIEZY1.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"161-XmT1kQOx+OJZ4N9LD9fZ2xhR/WY\"",
		"mtime": "2026-07-21T16:34:16.739Z",
		"size": 353,
		"path": "../public/assets/shield-alert-CeVIEZY1.js"
	},
	"/assets/shield-check-CUNOlybr.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"140-jMrk9ffTC35cP+m9Ctej29tLEIc\"",
		"mtime": "2026-07-21T16:34:16.741Z",
		"size": 320,
		"path": "../public/assets/shield-check-CUNOlybr.js"
	},
	"/assets/styles-DXeq1w8T.css": {
		"type": "text/css; charset=utf-8",
		"etag": "\"1f338-2pLPEcpoHFXAQPAr62XQ6KaoVZo\"",
		"mtime": "2026-07-21T16:34:16.810Z",
		"size": 127800,
		"path": "../public/assets/styles-DXeq1w8T.css"
	},
	"/assets/trending-up-nfklTAGz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"af-binAQFwiJt1xI9p74f/hBcx5jgs\"",
		"mtime": "2026-07-21T16:34:16.780Z",
		"size": 175,
		"path": "../public/assets/trending-up-nfklTAGz.js"
	},
	"/assets/terminal-Db6-BmZS.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"a2-D9qjku4mHNWT9cxU+k7jwACqJbM\"",
		"mtime": "2026-07-21T16:34:16.765Z",
		"size": 162,
		"path": "../public/assets/terminal-Db6-BmZS.js"
	},
	"/assets/routes-BdyRbR9J.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"49dc-0YqcgnermkCh4F4ayF2B7L3e7BM\"",
		"mtime": "2026-07-21T16:34:16.737Z",
		"size": 18908,
		"path": "../public/assets/routes-BdyRbR9J.js"
	},
	"/assets/triangle-alert-BzK38Qok.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"109-L9GPDGUgBxwzIytCpzZ2NBrvYgc\"",
		"mtime": "2026-07-21T16:34:16.797Z",
		"size": 265,
		"path": "../public/assets/triangle-alert-BzK38Qok.js"
	},
	"/assets/useAdminWs-DU-kNtaz.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"27b-/P8L+fDZ7KDDjROSKnuwOR/nYiI\"",
		"mtime": "2026-07-21T16:34:16.798Z",
		"size": 635,
		"path": "../public/assets/useAdminWs-DU-kNtaz.js"
	},
	"/assets/user-t1mOpn5_.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"c4-cVoyIyh21wik1hFwqH/U3Yh3UKM\"",
		"mtime": "2026-07-21T16:34:16.801Z",
		"size": 196,
		"path": "../public/assets/user-t1mOpn5_.js"
	},
	"/assets/users-DsFinHnQ.js": {
		"type": "text/javascript; charset=utf-8",
		"etag": "\"132-gfQKhQl1O/aZD0q9U+KecT6/Rzo\"",
		"mtime": "2026-07-21T16:34:16.803Z",
		"size": 306,
		"path": "../public/assets/users-DsFinHnQ.js"
	}
};
//#endregion
//#region #nitro/virtual/public-assets
var publicAssetBases = {};
function isPublicAssetURL(id = "") {
	if (public_assets_data_default[id]) return true;
	for (const base in publicAssetBases) if (id.startsWith(base)) return true;
	return false;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/route-rules.mjs
var headers = ((m) => function headersRouteRule(event) {
	for (const [key, value] of Object.entries(m.options || {})) event.res.headers.set(key, value);
});
//#endregion
//#region #nitro/virtual/routing
var findRouteRules = /* @__PURE__ */ (() => {
	const $0 = [{
		name: "headers",
		route: "/assets/**",
		handler: headers,
		options: { "cache-control": "public, max-age=31536000, immutable" }
	}];
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
		let s = p.split("/");
		if (s.length > 1) {
			if (s[1] === "assets") r.unshift({
				data: $0,
				params: { "_": s.slice(2).join("/") }
			});
		}
		return r;
	};
})();
var _lazy_Z7HloX = defineLazyEventHandler(() => import("./_chunks/ssr-renderer.mjs"));
var findRoute = /* @__PURE__ */ (() => {
	const data = {
		route: "/**",
		handler: _lazy_Z7HloX
	};
	return ((_m, p) => {
		return {
			data,
			params: { "_": p.slice(1) }
		};
	});
})();
[].filter(Boolean);
//#endregion
//#region node_modules/nitro/dist/runtime/internal/error/prod.mjs
var errorHandler = (error, event) => {
	const res = defaultHandler(error, event);
	return new FastResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event) {
	const unhandled = error.unhandled ?? !HTTPError.isError(error);
	const { status = 500, statusText = "" } = unhandled ? {} : error;
	if (status === 404) {
		const url = event.url || new URL(event.req.url);
		const baseURL = "/";
		if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) return {
			status: 302,
			headers: new Headers({ location: `${baseURL}${url.pathname.slice(1)}${url.search}` })
		};
	}
	const headers = new Headers(unhandled ? {} : error.headers);
	headers.set("content-type", "application/json; charset=utf-8");
	return {
		status,
		statusText,
		headers,
		body: {
			error: true,
			...unhandled ? {
				status,
				unhandled: true
			} : typeof error.toJSON === "function" ? error.toJSON() : {
				status,
				statusText,
				message: error.message
			}
		}
	};
}
//#endregion
//#region #nitro/virtual/error-handler
var errorHandlers = [errorHandler];
async function error_handler_default(error, event) {
	for (const handler of errorHandlers) try {
		const response = await handler(error, event, { defaultHandler });
		if (response) return response;
	} catch (error) {
		console.error(error);
	}
}
//#endregion
//#region #nitro/virtual/app
function createNitroApp() {
	const captureError = (error, errorCtx) => {
		if (errorCtx?.event) {
			const errors = errorCtx.event.req.context?.nitro?.errors;
			if (errors) errors.push({
				error,
				context: errorCtx
			});
		}
	};
	const h3App = createH3App({ onError(error, event) {
		return error_handler_default(error, event);
	} });
	let appHandler = (req) => {
		req.context ||= {};
		req.context.nitro = req.context.nitro || { errors: [] };
		return h3App.fetch(req);
	};
	return {
		fetch: appHandler,
		h3: h3App,
		hooks: void 0,
		captureError
	};
}
function createH3App(config) {
	const h3App = new H3Core(config);
	h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
	h3App["~getMiddleware"] = (event, route) => {
		const pathname = event.url.pathname;
		const method = event.req.method;
		const middleware = [];
		const routeRules = getRouteRules(method, pathname);
		event.context.routeRules = routeRules?.routeRules;
		if (routeRules?.routeRuleMiddleware.length) middleware.push(...routeRules.routeRuleMiddleware);
		if (route?.data?.middleware?.length) middleware.push(...route.data.middleware);
		return middleware;
	};
	return h3App;
}
//#endregion
//#region node_modules/nitro/dist/runtime/internal/app.mjs
var APP_ID = "default";
function useNitroApp() {
	let instance = useNitroApp._instance;
	if (instance) return instance;
	instance = useNitroApp._instance = createNitroApp();
	globalThis.__nitro__ = globalThis.__nitro__ || {};
	globalThis.__nitro__[APP_ID] = instance;
	return instance;
}
function useNitroHooks() {
	const nitroApp = useNitroApp();
	const hooks = nitroApp.hooks;
	if (hooks) return hooks;
	return nitroApp.hooks = new HookableCore();
}
function getRouteRules(method, pathname) {
	const m = findRouteRules(method, pathname);
	if (!m?.length) return { routeRuleMiddleware: [] };
	const routeRules = {};
	for (const layer of m) for (const rule of layer.data) {
		const currentRule = routeRules[rule.name];
		if (currentRule) {
			if (rule.options === false) {
				delete routeRules[rule.name];
				continue;
			}
			if (typeof currentRule.options === "object" && typeof rule.options === "object") currentRule.options = {
				...currentRule.options,
				...rule.options
			};
			else currentRule.options = rule.options;
			currentRule.route = rule.route;
			currentRule.params = {
				...currentRule.params,
				...layer.params
			};
		} else if (rule.options !== false) routeRules[rule.name] = {
			...rule,
			params: layer.params
		};
	}
	const middleware = [];
	const orderedRules = Object.values(routeRules).sort((a, b) => (a.handler?.order || 0) - (b.handler?.order || 0));
	for (const rule of orderedRules) {
		if (rule.options === false || !rule.handler) continue;
		middleware.push(rule.handler(rule));
	}
	return {
		routeRules,
		routeRuleMiddleware: middleware
	};
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs
function createHandler(hooks) {
	const nitroApp = useNitroApp();
	const nitroHooks = useNitroHooks();
	return {
		async fetch(request, env, context) {
			globalThis.__env__ = env;
			augmentReq(request, {
				env,
				context
			});
			const ctxExt = {};
			const url = new URL(request.url);
			if (hooks.fetch) {
				const res = await hooks.fetch(request, env, context, url, ctxExt);
				if (res) return res;
			}
			return await nitroApp.fetch(request);
		},
		scheduled(controller, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:scheduled", {
				controller,
				env,
				context
			}) || Promise.resolve());
		},
		email(message, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:email", {
				message,
				event: message,
				env,
				context
			}) || Promise.resolve());
		},
		queue(batch, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:queue", {
				batch,
				event: batch,
				env,
				context
			}) || Promise.resolve());
		},
		tail(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:tail", {
				traces,
				env,
				context
			}) || Promise.resolve());
		},
		trace(traces, env, context) {
			globalThis.__env__ = env;
			context.waitUntil(nitroHooks.callHook("cloudflare:trace", {
				traces,
				env,
				context
			}) || Promise.resolve());
		}
	};
}
function augmentReq(cfReq, ctx) {
	const req = cfReq;
	req.ip = cfReq.headers.get("cf-connecting-ip") || void 0;
	req.runtime ??= { name: "cloudflare" };
	req.runtime.cloudflare = {
		...req.runtime.cloudflare,
		...ctx
	};
	req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);
}
//#endregion
//#region node_modules/nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs
var cloudflare_module_default = createHandler({ fetch(cfRequest, env, context, url) {
	if (env.ASSETS && isPublicAssetURL(url.pathname)) return env.ASSETS.fetch(cfRequest);
} });
//#endregion
export { cloudflare_module_default as default };
