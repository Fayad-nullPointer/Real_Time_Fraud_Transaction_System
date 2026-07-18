"""
routers/dashboard.py
====================
GET  /api/dashboard/metrics      – aggregated KPI snapshot
WS   /api/dashboard/ws           – WebSocket stream for live events
GET  /api/dashboard/transactions – paginated transaction log for admin
GET  /api/dashboard/system       – backend/model health info
GET  /api/dashboard/fraud-map    – fraud-only transaction locations for map
GET  /api/dashboard/logs         – parsed JSON fraud event log entries
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from pathlib import Path
import psutil
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.db.postgres import get_db_pool
from backend.db.redis_client import get_redis
from backend.core.ws_manager import ws_manager
from backend.core.pipeline_wrapper import get_inference_time_ms

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics")
async def get_metrics():
    """Aggregated KPI snapshot for the top KPI cards."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        total_tx = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE tx_datetime >= $1", today_start
        )
        volume = await conn.fetchval(
            "SELECT COALESCE(SUM(tx_amount), 0) FROM transactions WHERE tx_datetime >= $1", today_start
        )
        fraud_detected = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE is_fraud = TRUE AND tx_datetime >= $1", today_start
        )
        confirmed_fraud = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status = 'DECLINED' AND tx_datetime >= $1", today_start
        )
        legitimate = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status = 'APPROVED' AND tx_datetime >= $1", today_start
        )
        false_positives = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status = 'VERIFIED' AND tx_datetime >= $1", today_start
        )
        active_customers = await conn.fetchval(
            "SELECT COUNT(DISTINCT customer_id) FROM transactions WHERE tx_datetime >= $1", today_start
        )
        active_terminals = await conn.fetchval(
            "SELECT COUNT(DISTINCT terminal_id) FROM transactions WHERE tx_datetime >= $1", today_start
        )

        # Hourly buckets for charts
        hourly_volume = await conn.fetch(
            """
            SELECT EXTRACT(HOUR FROM tx_datetime) AS hour,
                   COUNT(*) AS tx_count,
                   COALESCE(SUM(tx_amount), 0) AS total_amount,
                   COUNT(*) FILTER (WHERE is_fraud) AS fraud_count
            FROM transactions
            WHERE tx_datetime >= $1
            GROUP BY hour ORDER BY hour
            """,
            today_start,
        )

        # Fraud scenarios
        scenarios = await conn.fetch(
            """
            SELECT scenario_name, COUNT(*) AS cnt
            FROM transactions
            WHERE is_fraud = TRUE AND scenario_name IS NOT NULL AND tx_datetime >= $1
            GROUP BY scenario_name ORDER BY cnt DESC
            """,
            today_start,
        )

        # Top fraud reasons
        top_reasons = await conn.fetch(
            """
            SELECT top_reason, COUNT(*) AS cnt
            FROM transactions
            WHERE is_fraud = TRUE AND top_reason IS NOT NULL AND tx_datetime >= $1
            GROUP BY top_reason ORDER BY cnt DESC LIMIT 5
            """,
            today_start,
        )

        # OTP funnel
        otp_sent = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE is_fraud = TRUE AND tx_datetime >= $1", today_start
        )
        otp_verified = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status = 'VERIFIED' AND tx_datetime >= $1", today_start
        )

    fraud_rate = round((fraud_detected / total_tx * 100), 2) if total_tx else 0.0

    return {
        "total_transactions": total_tx,
        "transaction_volume": float(volume),
        "fraud_detected":     fraud_detected,
        "confirmed_fraud":    confirmed_fraud,
        "legitimate":         legitimate,
        "false_positives_corrected": false_positives,
        "fraud_rate":         fraud_rate,
        "active_customers":   active_customers,
        "active_terminals":   active_terminals,
        "otp_funnel": {
            "fraud_predictions": otp_sent,
            "otp_sent":          otp_sent,
            "otp_verified":      otp_verified,
            "confirmed_fraud":   confirmed_fraud,
        },
        "hourly": [dict(r) for r in hourly_volume],
        "scenarios": [dict(r) for r in scenarios],
        "top_reasons": [dict(r) for r in top_reasons],
    }


@router.get("/transactions")
async def list_transactions(limit: int = 50, offset: int = 0):
    """Paginated transaction list for the admin live table."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT transaction_id, customer_id, terminal_id, tx_amount,
                   tx_datetime, is_fraud, fraud_probability,
                   scenario_name, top_reason, status
            FROM transactions
            ORDER BY tx_datetime DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
    return [dict(r) for r in rows]


@router.get("/system")
async def system_health():
    """System health metrics for the health widget."""
    r = get_redis()

    # Redis check
    redis_ok = False
    cache_hit_rate = 0.0
    try:
        await r.ping()
        redis_ok = True
        info = await r.info("stats")
        hits = info.get("keyspace_hits", 0)
        misses = info.get("keyspace_misses", 0)
        cache_hit_rate = round(hits / (hits + misses) * 100, 1) if (hits + misses) else 0.0
    except Exception:
        pass

    # Machine resources
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory().percent
    disk = psutil.disk_usage("/").percent if os.name != "nt" else psutil.disk_usage("C:\\").percent

    return {
        "fastapi":   {"status": "running"},
        "postgres":  {"status": "connected"},
        "redis":     {"status": "connected" if redis_ok else "error", "cache_hit_rate": cache_hit_rate},
        "ml_model":  {
            "status":         "loaded",
            "version":        "v2.3",
            "inference_ms":   round(get_inference_time_ms(), 1),
        },
        "websocket": {"connected_clients": ws_manager.client_count},
        "resources": {"cpu": cpu, "ram": ram, "disk": disk},
    }


@router.get("/fraud-map")
async def fraud_map_data():
    """
    Returns only fraudulent transactions with lat/lon for both customer
    and terminal, so the map renders only real fraud hotspots.
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                t.transaction_id,
                t.customer_id,
                t.terminal_id,
                t.tx_amount,
                t.fraud_probability,
                t.scenario_name,
                t.status,
                t.tx_datetime,
                t.user_lat   AS customer_lat,
                t.user_lon   AS customer_lon,
                tr.latitude  AS terminal_lat,
                tr.longitude AS terminal_lon,
                tr.terminal_name
            FROM transactions t
            JOIN terminals tr ON t.terminal_id = tr.terminal_id
            WHERE t.is_fraud = TRUE
            ORDER BY t.tx_datetime DESC
            LIMIT 200
            """
        )
    return [dict(r) for r in rows]


@router.get("/logs")
async def get_logs(limit: int = 200, level: str = ""):
    """
    Reads logs/fraud_events.log (JSON-lines) and returns the latest entries.
    Optional ?level=WARNING to filter by log level.
    Strips Rich markup tags from messages before returning.
    """
    log_path = Path(__file__).resolve().parents[2] / "logs" / "fraud_events.log"
    if not log_path.exists():
        return []

    rich_re = re.compile(r"\[/?[a-zA-Z0-9_ ]+\]")

    entries = []
    lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    for raw in reversed(lines):          # newest first
        raw = raw.strip()
        if not raw:
            continue
        try:
            entry = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if level and entry.get("level", "").upper() != level.upper():
            continue
        # Clean up Rich markup in the message field
        entry["message"] = rich_re.sub("", entry.get("message", ""))
        entries.append(entry)
        if len(entries) >= limit:
            break
    return entries


@router.websocket("/ws")
async def dashboard_ws(ws: WebSocket):
    """WebSocket endpoint — admin dashboard connects here for live events."""
    await ws_manager.connect(ws)
    try:
        while True:
            # Keep connection alive; all broadcasting is done from transaction router
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
