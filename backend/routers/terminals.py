"""
routers/terminals.py
====================
GET /api/terminals  – return all active terminals with lat/lon for the map
"""
from __future__ import annotations

from fastapi import APIRouter

from backend.db.postgres import get_db_pool

router = APIRouter(prefix="/api/terminals", tags=["terminals"])


@router.get("")
async def list_terminals():
    """Return all active terminals with coordinates for the Leaflet map."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT terminal_id, terminal_name, latitude, longitude
            FROM terminals
            WHERE is_active = TRUE
            ORDER BY terminal_id
            """
        )
        if not rows:
            try:
                from backend.db.seed import seed_terminals
                await seed_terminals()
                rows = await conn.fetch(
                    """
                    SELECT terminal_id, terminal_name, latitude, longitude
                    FROM terminals
                    WHERE is_active = TRUE
                    ORDER BY terminal_id
                    """
                )
            except Exception as e:
                print(f"[terminals] Auto-seed note: {e}")
    return [dict(r) for r in rows]
