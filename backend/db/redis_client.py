"""
db/redis_client.py
==================
Redis client factory. Uses redis-py (async) with automatic in-memory fallback.
Allows running the application instantly without requiring Redis server installation.
"""
from __future__ import annotations

import os
import time
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

_client: aioredis.Redis | InMemoryRedis | None = None
_use_in_memory_redis = False


class InMemoryRedisPipeline:
    """Mock Redis transaction pipeline."""
    def __init__(self, db: dict):
        self.db = db
        self.commands = []

    def lpush(self, key: str, value: str | float):
        self.commands.append(('lpush', key, str(value)))
        return self

    def ltrim(self, key: str, start: int, stop: int):
        self.commands.append(('ltrim', key, start, stop))
        return self

    def zadd(self, key: str, mapping: dict):
        self.commands.append(('zadd', key, mapping))
        return self

    def zremrangebyscore(self, key: str, min_val: float, max_val: float):
        self.commands.append(('zremrangebyscore', key, min_val, max_val))
        return self

    async def execute(self) -> None:
        for cmd in self.commands:
            op = cmd[0]
            if op == 'lpush':
                key, val = cmd[1], cmd[2]
                if key not in self.db:
                    self.db[key] = []
                self.db[key].insert(0, val)
            elif op == 'ltrim':
                key, start, stop = cmd[1], cmd[2], cmd[3]
                if key in self.db:
                    # Redis inclusive stop
                    end = None if stop == -1 else stop + 1
                    self.db[key] = self.db[key][start:end]
            elif op == 'zadd':
                key, mapping = cmd[1], cmd[2]
                if key not in self.db:
                    self.db[key] = {}
                for member, score in mapping.items():
                    self.db[key][str(member)] = float(score)
            elif op == 'zremrangebyscore':
                key, min_val, max_val = cmd[1], cmd[2], cmd[3]
                if key in self.db:
                    self.db[key] = {
                        m: s for m, s in self.db[key].items()
                        if not (min_val <= s <= max_val)
                    }
        self.commands = []


class InMemoryRedis:
    """Mock Redis client storing keys in memory."""
    def __init__(self):
        self.db: dict = {}
        self.ttls: dict = {}

    def pipeline(self) -> InMemoryRedisPipeline:
        return InMemoryRedisPipeline(self.db)

    async def lrange(self, key: str, start: int, stop: int) -> list[str]:
        vals = self.db.get(key, [])
        end = None if stop == -1 else stop + 1
        return vals[start:end]

    async def zcount(self, key: str, min_val: str | float, max_val: str | float) -> int:
        zset = self.db.get(key, {})
        fmin = -float('inf') if min_val == '-inf' else float(min_val)
        fmax = float('inf') if max_val == '+inf' else float(max_val)
        return sum(1 for s in zset.values() if fmin <= s <= fmax)

    async def setex(self, key: str, seconds: int, value: str) -> None:
        self.db[key] = str(value)
        self.ttls[key] = time.time() + seconds

    async def get(self, key: str) -> str | None:
        if key in self.ttls and time.time() > self.ttls[key]:
            self.db.pop(key, None)
            self.ttls.pop(key, None)
            return None
        return self.db.get(key)

    async def delete(self, key: str) -> bool:
        self.db.pop(key, None)
        self.ttls.pop(key, None)
        return True

    async def ping(self) -> bool:
        return True


def get_redis() -> aioredis.Redis | InMemoryRedis:
    """Return the shared Redis client, creating it on first call."""
    global _client, _use_in_memory_redis
    if _client is None:
        if _use_in_memory_redis:
            _client = InMemoryRedis()
        else:
            _client = aioredis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379"),
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=1.0,
            )
    return _client


async def check_redis_connection() -> None:
    """Check Redis server health and switch to in-memory database on failure."""
    global _client, _use_in_memory_redis
    client = get_redis()
    if isinstance(client, InMemoryRedis):
        return
    try:
        # Fast health-check ping
        await client.ping()
        print("[redis] Connected to Redis successfully.")
    except Exception as e:
        print(f"[redis] Warning: Redis not available ({e}). Falling back to in-memory Redis emulator.")
        _use_in_memory_redis = True
        _client = InMemoryRedis()


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

async def store_otp(transaction_id: str, otp: str, ttl: int = 40) -> None:
    r = get_redis()
    await r.setex(f"otp:{transaction_id}", ttl, otp)


async def verify_otp(transaction_id: str, otp: str) -> bool:
    r = get_redis()
    stored = await r.get(f"otp:{transaction_id}")
    if stored and stored == otp:
        await r.delete(f"otp:{transaction_id}")
        return True
    return False
