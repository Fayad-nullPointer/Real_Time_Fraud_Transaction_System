/**
 * lib/geo.ts
 * Client-Side Location Resolver
 * Uses Browser GPS when available, or Client IP Geolocation (ipapi.co / ip-api.com)
 * when running over HTTP to resolve the user's real physical latitude/longitude.
 */

export async function resolveUserLocation(): Promise<{ lat: number; lng: number }> {
  // 1. Try Browser Geolocation API first
  if (typeof window !== "undefined" && "geolocation" in navigator) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      // Browser GPS blocked (e.g. HTTP non-secure origin), fallback to IP Geolocation
    }
  }

  // 2. Client-Side IP Geolocation via ipapi.co
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("https://ipapi.co/json/", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { lat: data.latitude, lng: data.longitude };
      }
    }
  } catch {
    // Secondary fallback
  }

  // 3. Secondary Client IP Geolocation via ip-api.com
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("http://ip-api.com/json/", { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (typeof data.lat === "number" && typeof data.lon === "number") {
        return { lat: data.lat, lng: data.lon };
      }
    }
  } catch {
    // Default fallback
  }

  // 4. Default fallback to Cairo coordinates (30.0444, 31.2357)
  return { lat: 30.0444, lng: 31.2357 };
}
