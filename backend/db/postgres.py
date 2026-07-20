"""
db/postgres.py
==============
PostgreSQL connection pool client with automatic built-in SQLite fallback.
Allows running the application instantly without requiring PostgreSQL server installation.
"""
from __future__ import annotations

import os
import re
import sqlite3
import asyncpg
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

_pool: asyncpg.Pool | SQLitePool | None = None
_use_sqlite = False
_sqlite_path = Path(__file__).resolve().parents[2] / "data" / "fallback_fraud.db"


class SQLiteRow(dict):
    """Replicates the Row indexing and type handling of asyncpg."""
    def __getitem__(self, key):
        if isinstance(key, str):
            for k in list(self.keys()):
                if k.lower() == key.lower():
                    val = super().__getitem__(k)
                    if k.lower() in ('is_fraud', 'is_active') and isinstance(val, int):
                        return bool(val)
                    if k.lower() in ('tx_datetime', 'created_at', 'otp_expires_at') and isinstance(val, str):
                        from datetime import datetime
                        try:
                            if 'T' in val:
                                return datetime.fromisoformat(val.replace("Z", "+00:00"))
                            return datetime.strptime(val, "%Y-%m-%d %H:%M:%S")
                        except ValueError:
                            return val
                    return val
        return super().__getitem__(key)


class SQLiteConnection:
    """Mock connection implementing basic asyncpg query methods."""
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row

    async def execute(self, query: str, *args) -> None:
        import asyncio
        q = _pg_to_sqlite_query(query)
        def _exec():
            with self.conn:
                return self.conn.execute(q, args)
        await asyncio.to_thread(_exec)

    async def fetch(self, query: str, *args) -> list[SQLiteRow]:
        import asyncio
        q = _pg_to_sqlite_query(query)
        def _fetch():
            cursor = self.conn.cursor()
            cursor.execute(q, args)
            return [SQLiteRow(r) for r in cursor.fetchall()]
        return await asyncio.to_thread(_fetch)

    async def fetchrow(self, query: str, *args) -> SQLiteRow | None:
        rows = await self.fetch(query, *args)
        return rows[0] if rows else None


class SQLitePool:
    """Mock connection pool matching asyncpg.Pool API."""
    def __init__(self, db_path: str):
        self.db_path = db_path

    def acquire(self):
        class PoolAcquireContext:
            def __init__(self, db_path: str):
                self.db_path = db_path
                self.conn = None

            async def __aenter__(self):
                self.conn = SQLiteConnection(self.db_path)
                return self.conn

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                if self.conn:
                    self.conn.conn.close()
        return PoolAcquireContext(self.db_path)


def _pg_to_sqlite_query(sql: str) -> str:
    """Convert PostgreSQL parameterized parameters and syntax to SQLite."""
    # Convert PG interval subtraction NOW() - ($1 || ' hours')::interval to SQLite datetime syntax
    sql = re.sub(
        r"NOW\(\)\s*-\s*\((.*?)\s*\|\|\s*' hours'\)::interval",
        r"datetime('now', '-' || \1 || ' hours')",
        sql,
        flags=re.IGNORECASE
    )
    # Convert NOW() to datetime('now')
    sql = re.sub(r'\bNOW\(\)', "datetime('now')", sql, flags=re.IGNORECASE)
    # Convert $1, $2 parameters to ?
    sql = re.sub(r'\$\d+', '?', sql)
    # Convert ILIKE to case-insensitive LIKE
    sql = re.sub(r'\bILIKE\b', 'LIKE', sql, flags=re.IGNORECASE)
    # Ignore PostgreSQL ALTER SEQUENCE restarts
    if "ALTER SEQUENCE" in sql:
        return "-- ALTER SEQUENCE IGNORED"
    return sql


async def get_db_pool() -> asyncpg.Pool | SQLitePool:
    """Return the shared connection pool, creating it on first call with SQLite fallback."""
    global _pool, _use_sqlite
    if _pool is None:
        try:
            # Fast connection attempt
            _pool = await asyncpg.create_pool(
                dsn=os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fraud_db"),
                min_size=1,
                max_size=5,
                command_timeout=2.0,
            )
            print("[postgres] Connected to PostgreSQL database successfully.")
        except Exception as e:
            print(f"[postgres] Warning: PostgreSQL not available ({e}). Falling back to SQLite database at: {_sqlite_path}")
            _use_sqlite = True
            _sqlite_path.parent.mkdir(parents=True, exist_ok=True)
            _pool = SQLitePool(str(_sqlite_path))
    return _pool


async def close_db_pool() -> None:
    global _pool
    if _pool:
        if not _use_sqlite:
            await _pool.close()
        _pool = None


SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    registration_lat REAL,
    registration_lon REAL,
    registration_ip TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    role TEXT NOT NULL DEFAULT 'user'
);
INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES ('customers', 99999);

CREATE TABLE IF NOT EXISTS terminals (
    terminal_id INTEGER PRIMARY KEY,
    terminal_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    terminal_id INTEGER NOT NULL,
    tx_amount REAL NOT NULL,
    tx_datetime TEXT NOT NULL,
    user_lat REAL,
    user_lon REAL,
    is_fraud INTEGER DEFAULT 0,
    fraud_probability REAL DEFAULT 0.0,
    scenario_id INTEGER,
    scenario_name TEXT,
    top_reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    shap_explanation TEXT,
    otp_expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""


async def apply_schema() -> None:
    """Apply schema (idempotent setup)."""
    pool = await get_db_pool()
    if _use_sqlite:
        async with pool.acquire() as conn:
            for stmt in SQLITE_SCHEMA.split(";"):
                if stmt.strip():
                    await conn.execute(stmt)
        print("[sqlite] SQLite schema applied successfully.")
    else:
        schema_path = Path(__file__).parent / "schema.sql"
        sql = schema_path.read_text(encoding="utf-8")
        async with pool.acquire() as conn:
            await conn.execute(sql)
        print("[postgres] PostgreSQL schema applied successfully.")

    # Seed default admin user (ID 100000, password '1234') if database has no customers
    from backend.core.security import hash_password
    async with pool.acquire() as conn:
        try:
            count_row = await conn.fetchrow("SELECT COUNT(*) as count FROM customers")
            if count_row and count_row["count"] == 0:
                pw_hash = hash_password("1234")
                await conn.execute(
                    """
                    INSERT INTO customers (customer_id, phone_number, password_hash, full_name, role)
                    VALUES (100000, '+201011216969', $1, 'System Admin', 'admin')
                    """,
                    pw_hash
                )
                print("[postgres/sqlite] Seeded default admin user: ID=100000, Password=1234")
        except Exception as e:
            print(f"[postgres/sqlite] Warning: Failed to seed default admin: {e}")
