"""
db/postgres.py
==============
Async PostgreSQL connection pool using asyncpg.
All backend modules import `get_db_pool()` to obtain a connection.
"""
from __future__ import annotations

import os
import asyncpg
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | None = None


async def get_db_pool() -> asyncpg.Pool:
    """Return the shared connection pool, creating it on first call."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.environ["DATABASE_URL"],
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def apply_schema() -> None:
    """Apply schema.sql to the database (idempotent — uses IF NOT EXISTS)."""
    schema_path = Path(__file__).parent / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(sql)
