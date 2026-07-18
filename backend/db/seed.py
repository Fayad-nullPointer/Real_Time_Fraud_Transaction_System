"""
db/seed.py
==========
Seeds the terminals table from the terminal_profiles extracted from
the feature_engineering.pkl artifact (or a fallback CSV/JSON list).

Usage:
    uv run python -m backend.db.seed
"""
from __future__ import annotations

import asyncio
import os
import sys
import pickle
import random
from pathlib import Path

# allow importing from project root
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from backend.db.postgres import apply_schema, get_db_pool


async def seed_terminals() -> None:
    await apply_schema()
    pool = await get_db_pool()

    # --- Try to load real terminal lat/lon from saved feature engineer ---
    terminals: list[dict] = []
    fe_path = ROOT / "models" / "feature_engineer.pkl"
    if fe_path.exists():
        with fe_path.open("rb") as f:
            fe = pickle.load(f)
        if hasattr(fe, "terminal_profiles_") and fe.terminal_profiles_ is not None:
            tp = fe.terminal_profiles_
            for tid, row in tp.iterrows():
                terminals.append({
                    "terminal_id":   int(tid),
                    "terminal_name": f"Terminal {tid}",
                    "latitude":      float(row.get("TERMINAL_LATITUDE", row.get("x_terminal_id", 30.0 + random.uniform(-0.5, 0.5)))),
                    "longitude":     float(row.get("TERMINAL_LONGITUDE", row.get("y_terminal_id", 31.0 + random.uniform(-0.5, 0.5)))),
                })
            print(f"[seed] Loaded {len(terminals)} terminals from feature_engineer.pkl")

    # --- Fallback: generate 100 mock terminals around Cairo ---
    if not terminals:
        print("[seed] feature_engineer.pkl not found or has no terminal_profiles_. Generating 100 mock terminals.")
        random.seed(42)
        for i in range(100):
            terminals.append({
                "terminal_id":   i,
                "terminal_name": f"Terminal {i:03d}",
                "latitude":      30.0 + random.uniform(-0.4, 0.4),
                "longitude":     31.2 + random.uniform(-0.4, 0.4),
            })

    async with pool.acquire() as conn:
        inserted = 0
        for t in terminals:
            result = await conn.execute(
                """
                INSERT INTO terminals (terminal_id, terminal_name, latitude, longitude)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (terminal_id) DO NOTHING
                """,
                t["terminal_id"], t["terminal_name"], t["latitude"], t["longitude"],
            )
            if result != "INSERT 0 0":
                inserted += 1
        print(f"[seed] Inserted {inserted} terminals (skipped duplicates).")


if __name__ == "__main__":
    asyncio.run(seed_terminals())
