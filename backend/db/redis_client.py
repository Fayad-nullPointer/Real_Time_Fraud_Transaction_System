"""
db/redis_client.py
==================
Redis client factory. Uses redis-py (async).

Supports all velocity features:
  - customer:{id}:lags          → LIST  (last 3 tx amounts)
  - customer:{id}:tx_times      → ZSET  (timestamps for 1h/4h velocity)
  - terminal:{id}:tx_times      → ZSET  (timestamps)
  - terminal:{id}:customers     → ZSET  (customer IDs in last 1h window)
  - otp:{transaction_id}        → STRING with 300s TTL
"""
from __future__ import annotations

import os
import time
import redis.asyncio as aioredis

_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the shared Redis client, creating it on first call."""
    global _client
    if _client is None:
        _client = aioredis.from_url(
            os.environ.get("REDIS_URL", "redis://localhost:6379"),
            encoding="utf-8",
            decode_responses=True,
        )
    return _client


# ─── Customer velocity helpers ───────────────────────────────────────────────

async def push_customer_lag(customer_id: int, amount: float) -> None:
    r = get_redis()
    key = f"customer:{customer_id}:lags"
    pipe = r.pipeline()
    pipe.lpush(key, amount)
    pipe.ltrim(key, 0, 2)          # keep only last 3
    await pipe.execute()


async def get_customer_lags(customer_id: int) -> list[float]:
    r = get_redis()
    vals = await r.lrange(f"customer:{customer_id}:lags", 0, 2)
    return [float(v) for v in vals]


async def push_customer_tx_time(customer_id: int, tx_id: str, ts: float | None = None) -> None:
    r = get_redis()
    ts = ts or time.time()
    key = f"customer:{customer_id}:tx_times"
    pipe = r.pipeline()
    pipe.zadd(key, {tx_id: ts})
    # prune entries older than 4 hours
    pipe.zremrangebyscore(key, 0, ts - 4 * 3600)
    await pipe.execute()


async def count_customer_tx(customer_id: int, window_seconds: int) -> int:
    r = get_redis()
    now = time.time()
    return await r.zcount(
        f"customer:{customer_id}:tx_times",
        now - window_seconds,
        "+inf",
    )


# ─── Terminal velocity helpers ────────────────────────────────────────────────

async def push_terminal_event(terminal_id: int, customer_id: int, tx_id: str, ts: float | None = None) -> None:
    r = get_redis()
    ts = ts or time.time()
    pipe = r.pipeline()
    pipe.zadd(f"terminal:{terminal_id}:tx_times", {tx_id: ts})
    pipe.zremrangebyscore(f"terminal:{terminal_id}:tx_times", 0, ts - 4 * 3600)
    pipe.zadd(f"terminal:{terminal_id}:customers", {str(customer_id): ts})
    pipe.zremrangebyscore(f"terminal:{terminal_id}:customers", 0, ts - 1 * 3600)
    await pipe.execute()


async def count_terminal_tx(terminal_id: int, window_seconds: int) -> int:
    r = get_redis()
    now = time.time()
    return await r.zcount(
        f"terminal:{terminal_id}:tx_times",
        now - window_seconds,
        "+inf",
    )


async def count_terminal_distinct_customers(terminal_id: int) -> int:
    r = get_redis()
    now = time.time()
    return await r.zcount(
        f"terminal:{terminal_id}:customers",
        now - 3600,   # last 1h
        "+inf",
    )


# ─── OTP helpers ─────────────────────────────────────────────────────────────

async def store_otp(transaction_id: str, otp: str, ttl: int = 300) -> None:
    r = get_redis()
    await r.setex(f"otp:{transaction_id}", ttl, otp)


async def verify_otp(transaction_id: str, otp: str) -> bool:
    r = get_redis()
    stored = await r.get(f"otp:{transaction_id}")
    if stored and stored == otp:
        await r.delete(f"otp:{transaction_id}")
        return True
    return False
