"""
core/geolocation.py
===================
Resolves a user's approximate lat/lon from their IP address when
GPS coordinates are not available, and resolves a human-readable
"City, Country" label from lat/lon coordinates (used by the admin
dashboard's Customers view).

Uses the free ip-api.com endpoint (no API key needed) for IP -> coords,
and the free OpenStreetMap Nominatim endpoint for coords -> place name.
Both fail soft: on any error / timeout they return a safe fallback instead
of raising, so a flaky third-party service never breaks a request.
"""
from __future__ import annotations

import httpx


async def resolve_location_from_ip(ip: str) -> tuple[float, float]:
    """
    Returns (latitude, longitude) for the given IP.
    If the IP is private / localhost / lookup fails, returns (0.0, 0.0).
    """
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return 0.0, 0.0
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"http://ip-api.com/json/{ip}?fields=lat,lon,status")
            data = resp.json()
            if data.get("status") == "success":
                return float(data["lat"]), float(data["lon"])
    except Exception:
        pass
    return 0.0, 0.0


# In-memory cache, keyed by coordinates rounded to ~1km precision, so the
# same neighborhood is only ever geocoded once per process lifetime.
# Nominatim's usage policy asks for at most ~1 request/sec, so caching also
# keeps the dashboard well inside that limit for a small/medium customer base.
_geocode_cache: dict[tuple[float, float], str] = {}


async def resolve_city_from_coords(lat: float | None, lon: float | None) -> str:
    """
    Returns a short "City, Country" label for the given coordinates
    (e.g. "Tanta, Egypt"). Returns "Unknown" if coordinates are missing
    or the lookup fails for any reason — never raises.
    """
    if lat is None or lon is None:
        return "Unknown"

    key = (round(float(lat), 2), round(float(lon), 2))
    if key in _geocode_cache:
        return _geocode_cache[key]

    label = "Unknown"
    try:
        async with httpx.AsyncClient(
            timeout=3.0, headers={"User-Agent": "FraudShield-Dashboard/1.0"}
        ) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lon, "format": "json", "zoom": 10},
            )
            data = resp.json()
            addr = data.get("address", {})
            city = (
                addr.get("city") or addr.get("town")
                or addr.get("village") or addr.get("county")
            )
            country = addr.get("country")
            parts = [p for p in (city, country) if p]
            if parts:
                label = ", ".join(parts)
    except Exception:
        pass

    _geocode_cache[key] = label
    return label