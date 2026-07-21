import { a as __toESM } from "../_runtime.mjs";
import { n as require_jsx_runtime, r as require_react } from "../_libs/react+tanstack__react-query.mjs";
import { A as Layers, C as Maximize2, n as ZoomIn, t as ZoomOut, x as Navigation } from "../_libs/lucide-react.mjs";
import { t as require_leaflet_src } from "../_libs/leaflet.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/GoogleTerminalMap-wSxea593.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_leaflet_src = /* @__PURE__ */ __toESM(require_leaflet_src());
function GoogleTerminalMap({ terminals, selectedId, onSelect, userCoords, height = "420px" }) {
	const containerRef = (0, import_react.useRef)(null);
	const mapRef = (0, import_react.useRef)(null);
	const markersLayerRef = (0, import_react.useRef)(null);
	const selectedMarkerRef = (0, import_react.useRef)(null);
	const [mapType, setMapType] = (0, import_react.useState)("roadmap");
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setMounted(true);
	}, []);
	(0, import_react.useEffect)(() => {
		if (!mounted || !containerRef.current || mapRef.current) return;
		const initialLat = userCoords?.lat ?? terminals[0]?.latitude ?? 30.0444;
		const initialLng = userCoords?.lng ?? terminals[0]?.longitude ?? 31.2357;
		const map = import_leaflet_src.default.map(containerRef.current, {
			center: [initialLat, initialLng],
			zoom: 12,
			zoomControl: false,
			preferCanvas: true
		});
		import_leaflet_src.default.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
			maxZoom: 20,
			subdomains: [
				"mt0",
				"mt1",
				"mt2",
				"mt3"
			],
			attribution: "&copy; <a href=\"https://maps.google.com\" target=\"_blank\">Google Maps</a>"
		}).addTo(map);
		markersLayerRef.current = import_leaflet_src.default.layerGroup().addTo(map);
		mapRef.current = map;
		return () => {
			map.remove();
			mapRef.current = null;
		};
	}, [mounted]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map) return;
		map.eachLayer((layer) => {
			if (layer instanceof import_leaflet_src.default.TileLayer) map.removeLayer(layer);
		});
		const url = mapType === "satellite" ? "https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}" : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";
		import_leaflet_src.default.tileLayer(url, {
			maxZoom: 20,
			subdomains: [
				"mt0",
				"mt1",
				"mt2",
				"mt3"
			],
			attribution: "&copy; <a href=\"https://maps.google.com\" target=\"_blank\">Google Maps</a>"
		}).addTo(map);
	}, [mapType]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		const layerGroup = markersLayerRef.current;
		if (!map || !layerGroup) return;
		layerGroup.clearLayers();
		if (terminals.length === 0) return;
		const bounds = import_leaflet_src.default.latLngBounds([]);
		terminals.forEach((t) => {
			const isSelected = selectedId === t.terminal_id;
			const fraudRate = t.fraud_rate ?? 0;
			const riskScore = t.risk_score ?? 0;
			const isHighRisk = fraudRate > .15 || riskScore > 60;
			const isMedRisk = fraudRate > .05 || riskScore > 30;
			const color = isHighRisk ? "#EF4444" : isMedRisk ? "#F59E0B" : "#22C55E";
			bounds.extend([t.latitude, t.longitude]);
			const marker = import_leaflet_src.default.circleMarker([t.latitude, t.longitude], {
				radius: isSelected ? 10 : 7,
				fillColor: color,
				color: isSelected ? "#FFFFFF" : "#000000",
				weight: isSelected ? 3 : 1.5,
				opacity: 1,
				fillOpacity: isSelected ? .95 : .8
			});
			const popupHtml = `
        <div style="font-family: Inter, sans-serif; color: #fff; padding: 4px;">
          <div style="font-size: 10px; text-transform: uppercase; color: #9ca3af; font-family: monospace;">TRM-${t.terminal_id}</div>
          <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${t.terminal_name}</div>
          <div style="display: flex; gap: 8px; margin-top: 6px; font-size: 11px;">
            <span style="color: ${color}; font-weight: 500;">
              ${isHighRisk ? "High Risk" : isMedRisk ? "Medium Risk" : "Normal"}
            </span>
            ${t.fraud_rate !== void 0 ? `<span style="color: #9ca3af;">• ${(fraudRate * 100).toFixed(1)}% fraud</span>` : ""}
          </div>
        </div>
      `;
			marker.bindTooltip(popupHtml, {
				direction: "top",
				className: "custom-leaflet-tooltip",
				offset: [0, -8]
			});
			marker.on("click", () => {
				onSelect(t);
				map.panTo([t.latitude, t.longitude], {
					animate: true,
					duration: .5
				});
			});
			layerGroup.addLayer(marker);
			if (isSelected) selectedMarkerRef.current = marker;
		});
		if (terminals.length > 1) map.fitBounds(bounds, {
			padding: [40, 40],
			maxZoom: 15
		});
		else if (terminals.length === 1) map.setView([terminals[0].latitude, terminals[0].longitude], 14);
	}, [
		terminals,
		selectedId,
		onSelect
	]);
	(0, import_react.useEffect)(() => {
		const map = mapRef.current;
		if (!map || !userCoords) return;
		const userMarker = import_leaflet_src.default.circleMarker([userCoords.lat, userCoords.lng], {
			radius: 8,
			fillColor: "#06B6D4",
			color: "#FFFFFF",
			weight: 2,
			fillOpacity: 1
		});
		userMarker.bindTooltip("You are here", {
			permanent: false,
			direction: "top"
		});
		userMarker.addTo(map);
		return () => {
			userMarker.remove();
		};
	}, [userCoords]);
	const locateUser = () => {
		if (!mapRef.current) return;
		if (userCoords) mapRef.current.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 1.2 });
		else if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition((p) => {
			mapRef.current?.flyTo([p.coords.latitude, p.coords.longitude], 15, { duration: 1.2 });
		}, () => {
			if (terminals.length > 0) mapRef.current?.flyTo([terminals[0].latitude, terminals[0].longitude], 14);
		});
	};
	const resetZoom = () => {
		if (!mapRef.current || terminals.length === 0) return;
		const bounds = import_leaflet_src.default.latLngBounds(terminals.map((t) => [t.latitude, t.longitude]));
		mapRef.current.fitBounds(bounds, {
			padding: [40, 40],
			maxZoom: 15
		});
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl",
		style: { height },
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: containerRef,
				className: "h-full w-full z-0"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute right-3 top-3 z-10 flex flex-col gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setMapType(mapType === "roadmap" ? "satellite" : "roadmap"),
						className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90",
						title: `Switch to ${mapType === "roadmap" ? "Satellite" : "Roadmap"} view`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Layers, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => mapRef.current?.zoomIn(),
						className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90",
						title: "Zoom In",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoomIn, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => mapRef.current?.zoomOut(),
						className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90",
						title: "Zoom Out",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoomOut, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: locateUser,
						className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-[color:var(--cyan)] backdrop-blur hover:bg-black/90",
						title: "Center on my location",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigation, { className: "h-4 w-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: resetZoom,
						className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90",
						title: "Fit all terminals",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Maximize2, { className: "h-4 w-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] backdrop-blur",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 text-white",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--success)] shadow-[0_0_6px_var(--success)]" }), " Low Risk"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 text-white",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--warning)] shadow-[0_0_6px_var(--warning)]" }), " Medium Risk"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 text-white",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] shadow-[0_0_6px_var(--danger)]" }), " High Risk"]
					}),
					userCoords && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5 border-l border-white/20 pl-2.5 text-[color:var(--cyan)]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-2.5 w-2.5 rounded-full bg-[color:var(--cyan)] shadow-[0_0_6px_var(--cyan)]" }), " You"]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", { children: `
        .custom-leaflet-tooltip {
          background: rgba(15, 23, 42, 0.92) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px !important;
          padding: 6px 10px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(8px) !important;
        }
        .custom-leaflet-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.92) !important;
        }
      ` })
		]
	});
}
//#endregion
export { GoogleTerminalMap as t };
