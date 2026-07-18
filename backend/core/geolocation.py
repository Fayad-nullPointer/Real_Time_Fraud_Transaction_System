"""
core/geolocation.py
===================
Resolves a user's approximate lat/lon from their IP address when
GPS coordinates are not available.

Uses the free ip-api.com endpoint (no API key needed).
Falls back to (0.0, 0.0) on failure.
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
