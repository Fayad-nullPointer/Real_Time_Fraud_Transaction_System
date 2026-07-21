import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import { MapPin, Navigation, Layers, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export interface MapTerminal {
  terminal_id: number;
  terminal_name: string;
  latitude: number;
  longitude: number;
  fraud_rate?: number;
  risk_score?: number;
}

interface GoogleTerminalMapProps {
  terminals: MapTerminal[];
  selectedId: number | null;
  onSelect: (t: MapTerminal) => void;
  userCoords?: { lat: number; lng: number } | null;
  height?: string;
}

export function GoogleTerminalMap({
  terminals,
  selectedId,
  onSelect,
  userCoords,
  height = "420px",
}: GoogleTerminalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedMarkerRef = useRef<L.CircleMarker | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Initialize Leaflet map instance (Browser-only)
  useEffect(() => {
    if (!mounted || !containerRef.current || mapRef.current) return;

    // Center default on Cairo/Egypt or first terminal or NY
    const initialLat = userCoords?.lat ?? terminals[0]?.latitude ?? 30.0444;
    const initialLng = userCoords?.lng ?? terminals[0]?.longitude ?? 31.2357;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: false,
      preferCanvas: true, // Hardware-accelerated Canvas for zero lag
    });

    // Google Maps tile layer (Subdomains mt0..mt3)
    const googleRoadmap = L.tileLayer(
      "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
      {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"],
        attribution: '&copy; <a href="https://maps.google.com" target="_blank">Google Maps</a>',
      }
    );

    googleRoadmap.addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mounted]);

  // 2. Switch tile layers between Google Roadmap & Google Satellite
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing tile layers
    map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    const url =
      mapType === "satellite"
        ? "https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}"
        : "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}";

    const newLayer = L.tileLayer(url, {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      attribution: '&copy; <a href="https://maps.google.com" target="_blank">Google Maps</a>',
    });

    newLayer.addTo(map);
  }, [mapType]);

  // 3. Render / update markers efficiently without React re-rendering overhead
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = markersLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (terminals.length === 0) return;

    const bounds = L.latLngBounds([]);

    terminals.forEach((t) => {
      const isSelected = selectedId === t.terminal_id;
      const fraudRate = t.fraud_rate ?? 0;
      const riskScore = t.risk_score ?? 0;

      // Color coding for risk level
      const isHighRisk = fraudRate > 0.15 || riskScore > 60;
      const isMedRisk = fraudRate > 0.05 || riskScore > 30;

      const color = isHighRisk ? "#EF4444" : isMedRisk ? "#F59E0B" : "#22C55E";

      bounds.extend([t.latitude, t.longitude]);

      // Circle marker on canvas for 60fps performance
      const marker = L.circleMarker([t.latitude, t.longitude], {
        radius: isSelected ? 10 : 7,
        fillColor: color,
        color: isSelected ? "#FFFFFF" : "#000000",
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        fillOpacity: isSelected ? 0.95 : 0.8,
      });

      // Dark custom popup
      const popupHtml = `
        <div style="font-family: Inter, sans-serif; color: #fff; padding: 4px;">
          <div style="font-size: 10px; text-transform: uppercase; color: #9ca3af; font-family: monospace;">TRM-${t.terminal_id}</div>
          <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${t.terminal_name}</div>
          <div style="display: flex; gap: 8px; margin-top: 6px; font-size: 11px;">
            <span style="color: ${color}; font-weight: 500;">
              ${isHighRisk ? "High Risk" : isMedRisk ? "Medium Risk" : "Normal"}
            </span>
            ${t.fraud_rate !== undefined ? `<span style="color: #9ca3af;">• ${(fraudRate * 100).toFixed(1)}% fraud</span>` : ""}
          </div>
        </div>
      `;

      marker.bindTooltip(popupHtml, {
        direction: "top",
        className: "custom-leaflet-tooltip",
        offset: [0, -8],
      });

      marker.on("click", () => {
        onSelect(t);
        map.panTo([t.latitude, t.longitude], { animate: true, duration: 0.5 });
      });

      layerGroup.addLayer(marker);

      if (isSelected) {
        selectedMarkerRef.current = marker;
      }
    });

    // Auto-fit bounds if first load and multiple markers exist
    if (terminals.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else if (terminals.length === 1) {
      map.setView([terminals[0].latitude, terminals[0].longitude], 14);
    }
  }, [terminals, selectedId, onSelect]);

  // Handle User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userCoords) return;

    const userMarker = L.circleMarker([userCoords.lat, userCoords.lng], {
      radius: 8,
      fillColor: "#06B6D4",
      color: "#FFFFFF",
      weight: 2,
      fillOpacity: 1,
    });

    userMarker.bindTooltip("You are here", { permanent: false, direction: "top" });
    userMarker.addTo(map);

    return () => {
      userMarker.remove();
    };
  }, [userCoords]);

  const locateUser = () => {
    if (!mapRef.current) return;
    if (userCoords) {
      mapRef.current.flyTo([userCoords.lat, userCoords.lng], 15, { duration: 1.2 });
    } else if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          mapRef.current?.flyTo([p.coords.latitude, p.coords.longitude], 15, { duration: 1.2 });
        },
        () => {
          if (terminals.length > 0) {
            mapRef.current?.flyTo([terminals[0].latitude, terminals[0].longitude], 14);
          }
        }
      );
    }
  };

  const resetZoom = () => {
    if (!mapRef.current || terminals.length === 0) return;
    const bounds = L.latLngBounds(terminals.map((t) => [t.latitude, t.longitude]));
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-xl" style={{ height }}>
      {/* Map Container */}
      <div ref={containerRef} className="h-full w-full z-0" />

      {/* Floating Control Toolbar */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        {/* Toggle Map Type (Roadmap / Satellite) */}
        <button
          type="button"
          onClick={() => setMapType(mapType === "roadmap" ? "satellite" : "roadmap")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90"
          title={`Switch to ${mapType === "roadmap" ? "Satellite" : "Roadmap"} view`}
        >
          <Layers className="h-4 w-4" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        {/* Locate Me */}
        <button
          type="button"
          onClick={locateUser}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-[color:var(--cyan)] backdrop-blur hover:bg-black/90"
          title="Center on my location"
        >
          <Navigation className="h-4 w-4" />
        </button>

        {/* Reset View */}
        <button
          type="button"
          onClick={resetZoom}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-black/90"
          title="Fit all terminals"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] backdrop-blur">
        <span className="inline-flex items-center gap-1.5 text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--success)] shadow-[0_0_6px_var(--success)]" /> Low Risk
        </span>
        <span className="inline-flex items-center gap-1.5 text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--warning)] shadow-[0_0_6px_var(--warning)]" /> Medium Risk
        </span>
        <span className="inline-flex items-center gap-1.5 text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--danger)] shadow-[0_0_6px_var(--danger)]" /> High Risk
        </span>
        {userCoords && (
          <span className="inline-flex items-center gap-1.5 border-l border-white/20 pl-2.5 text-[color:var(--cyan)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--cyan)] shadow-[0_0_6px_var(--cyan)]" /> You
          </span>
        )}
      </div>

      {/* Tooltip Styling */}
      <style>{`
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
      `}</style>
    </div>
  );
}
