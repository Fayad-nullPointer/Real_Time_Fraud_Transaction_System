"""
routers/dashboard.py
====================
GET  /api/dashboard/metrics      – aggregated KPI snapshot
WS   /api/dashboard/ws           – WebSocket stream for live events
GET  /api/dashboard/transactions – paginated transaction log for admin
GET  /api/dashboard/transactions/{transaction_id} – single transaction detail
                                    (incl. SHAP explanation) for the
                                    "click a transaction" detail view
GET  /api/dashboard/system       – backend/model health info
GET  /api/dashboard/fraud-map    – fraud-only transaction locations for map
GET  /api/dashboard/logs         – parsed JSON fraud event log entries
GET  /api/dashboard/customers    – per-customer summary (for the Customers tab)
GET  /api/dashboard/customers/{customer_id} – full customer profile + recent txns

Every REST endpoint here requires an admin JWT (Depends(get_current_admin)).
The dashboard is admin-only for now — see routers/auth.py for the role
system. The WebSocket can't send an Authorization header, so it takes the
token as a `?token=` query param instead (see dashboard_ws below) — the
frontend passes the same JWT it got from /api/auth/login.
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

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from backend.db.postgres import get_db_pool
from backend.db.redis_client import get_redis
from backend.core.ws_manager import ws_manager
from backend.core.geolocation import resolve_city_from_coords
from backend.core.security import decode_token
from backend.routers.auth import get_current_admin
from backend.core.pipeline_wrapper import get_inference_time_ms, get_customer_state


router = APIRouter(
    prefix="/api/dashboard",
    tags=["dashboard"],
)


def _compute_risk_score(avg_fraud_probability, confirmed_fraud_count, total_txns) -> int:
    """
    Blended 0-100 risk score for a customer:

      50% average fraud probability  — the model's average confidence,
                                        across every transaction, that it
                                        looked like fraud.
      50% confirmed-fraud rate       — the share of the customer's
                                        transactions that were actually
                                        DECLINED (OTP failed / timed out),
                                        i.e. fraud the pipeline caught AND
                                        the customer failed to verify.

    Averaging model confidence alone rewards/punishes customers based only
    on how "suspicious-looking" their transactions were, even if every one
    of them was ultimately verified as legitimate. Blending in the
    confirmed-fraud rate makes the score track real outcomes as well as
    raw model confidence. Returns 0 for a customer with no transactions.
    """
    total_txns = total_txns or 0
    avg_fraud_probability = float(avg_fraud_probability or 0.0)
    confirmed_fraud_count = confirmed_fraud_count or 0

    if total_txns == 0:
        return 0

    confirmed_fraud_rate = confirmed_fraud_count / total_txns
    blended = 0.5 * avg_fraud_probability + 0.5 * confirmed_fraud_rate
    return round(blended * 100)


def _parse_shap(value):
    """shap_explanation is stored as JSONB; asyncpg may hand it back as a
    str or as an already-decoded object depending on driver/codec setup —
    normalize to a Python list/dict either way."""
    if value is None:
        return []
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return []



@router.get("/customers/{customer_id}/state")
async def customer_feature_state(customer_id: int, _: dict = Depends(get_current_admin)):
    """
    Live snapshot of the ML pipeline's internal state for this customer:
    stored profile, spending tier, cold-start/warm status, and the
    realtime lag/velocity buffers actually used at scoring time.

    Distinct from GET /customers/{customer_id}, which reports business
    stats computed from the Postgres transaction history — this endpoint
    shows what the model itself currently "remembers".
    """
    try:
        return get_customer_state(customer_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

@router.get("/metrics")
async def get_metrics(_: dict = Depends(get_current_admin),):
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

        # All-time registered totals (independent of today's activity window)
        registered_customers = await conn.fetchval("SELECT COUNT(*) FROM customers")
        registered_terminals = await conn.fetchval("SELECT COUNT(*) FROM terminals")

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
        "registered_customers": registered_customers,
        "registered_terminals": registered_terminals,
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
async def list_transactions(_: dict = Depends(get_current_admin), limit: int = 50, offset: int = 0):
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


@router.get("/transactions/{transaction_id}")
async def transaction_detail(transaction_id: str, _: dict = Depends(get_current_admin),):
    """
    Full detail for ONE transaction, including its ranked SHAP explanation
    (the features that contributed most to fraud_probability). This is
    what the dashboard calls when an admin clicks a specific transaction
    row — in the Live/Fraud tables or in a customer's recent-transactions
    list in the Customers tab.
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT transaction_id, customer_id, terminal_id, tx_amount, tx_datetime,
                   is_fraud, fraud_probability, scenario_id, scenario_name,
                   top_reason, status, shap_explanation
            FROM transactions
            WHERE transaction_id = $1
            """,
            transaction_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    d = dict(row)
    d["shap_explanation"] = _parse_shap(d.get("shap_explanation"))
    return d


@router.get("/system")
async def system_health(_: dict = Depends(get_current_admin),):
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
async def fraud_map_data(_: dict = Depends(get_current_admin),):
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
async def get_logs(_: dict = Depends(get_current_admin), limit: int = 200, level: str = ""):
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


@router.get("/customers")
async def list_customers(_: dict = Depends(get_current_admin), limit: int = 200):
    """
    Per-customer summary row for the admin Customers tab:
    Customer, Location, Txns, Avg amount, Risk score.

    Risk score is the customer's average fraud_probability across all of
    their transactions, expressed as 0-100 (higher = riskier).
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                c.customer_id,
                c.phone_number,
                c.full_name,
                c.registration_lat,
                c.registration_lon,
                COUNT(t.transaction_id)                    AS total_txns,
                COALESCE(AVG(t.tx_amount), 0)               AS avg_amount,
                COALESCE(AVG(t.fraud_probability), 0)       AS avg_fraud_probability,
                COUNT(*) FILTER (WHERE t.status = 'DECLINED') AS confirmed_fraud_count,
                COUNT(DISTINCT t.terminal_id)                AS terminals_used
            FROM customers c
            LEFT JOIN transactions t ON t.customer_id = c.customer_id
            GROUP BY c.customer_id
            ORDER BY c.customer_id
            LIMIT $1
            """,
            limit,
        )

    results = []
    for r in rows:
        location = await resolve_city_from_coords(r["registration_lat"], r["registration_lon"])
        results.append({
            "customer_id":    r["customer_id"],
            "phone_number":   r["phone_number"],
            "full_name":      r["full_name"],
            "location":       location,
            "lat":            float(r["registration_lat"]) if r["registration_lat"] is not None else None,
            "lon":            float(r["registration_lon"]) if r["registration_lon"] is not None else None,
            "total_txns":     r["total_txns"],
            "avg_amount":     round(float(r["avg_amount"]), 2),
            "terminals_used": r["terminals_used"],
            "risk_score":     _compute_risk_score(
                                  r["avg_fraud_probability"], r["confirmed_fraud_count"], r["total_txns"]
                              ),
        })
    return results


@router.get("/customers/{customer_id}")
async def customer_profile(customer_id: int, _: dict = Depends(get_current_admin),):
    """
    Full profile for one customer, for the Customers-tab detail modal:
    contact info, location, mean/std transaction amount, txns/day,
    terminals used, total txns, risk score, and the 5 most recent
    transactions (each with its transaction_id, so the frontend can fetch
    GET /api/dashboard/transactions/{transaction_id} for the full SHAP
    breakdown when one is clicked).
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        cust = await conn.fetchrow(
            """
            SELECT customer_id, phone_number, full_name,
                   registration_lat, registration_lon
            FROM customers WHERE customer_id = $1
            """,
            customer_id,
        )
        if cust is None:
            raise HTTPException(status_code=404, detail="Customer not found.")

        stats = await conn.fetchrow(
            """
            SELECT
                COUNT(*)                              AS total_txns,
                COALESCE(AVG(tx_amount), 0)            AS mean_amount,
                COALESCE(STDDEV_POP(tx_amount), 0)     AS std_amount,
                COALESCE(AVG(fraud_probability), 0)    AS avg_fraud_probability,
                COUNT(*) FILTER (WHERE status = 'DECLINED') AS confirmed_fraud_count,
                COUNT(DISTINCT terminal_id)             AS terminals_used,
                MIN(tx_datetime)                        AS first_tx,
                MAX(tx_datetime)                        AS last_tx
            FROM transactions
            WHERE customer_id = $1
            """,
            customer_id,
        )

        recent_rows = await conn.fetch(
            """
            SELECT transaction_id, tx_amount, tx_datetime, is_fraud, status,
                   fraud_probability, scenario_name, top_reason
            FROM transactions
            WHERE customer_id = $1
            ORDER BY tx_datetime DESC
            LIMIT 5
            """,
            customer_id,
        )

    total_txns = stats["total_txns"] or 0
    first_tx, last_tx = stats["first_tx"], stats["last_tx"]
    if first_tx and last_tx and total_txns:
        days_span = max((last_tx - first_tx).total_seconds() / 86400.0, 1.0)
        txns_per_day = round(total_txns / days_span, 1)
    else:
        txns_per_day = 0.0

    location = await resolve_city_from_coords(cust["registration_lat"], cust["registration_lon"])

    now = datetime.now(timezone.utc)
    recent_transactions = []
    for r in recent_rows:
        tx_dt = r["tx_datetime"]
        days_ago = max(int((now - tx_dt).total_seconds() // 86400), 0) if tx_dt else None
        recent_transactions.append({
            "transaction_id": r["transaction_id"],
            "tx_amount":       float(r["tx_amount"]),
            "days_ago":        days_ago,
            "is_fraud":        r["is_fraud"],
            "status":          r["status"],
            "fraud_probability": float(r["fraud_probability"] or 0.0),
            "scenario_name":   r["scenario_name"],
            "top_reason":      r["top_reason"],
        })

    return {
        "customer_id":    cust["customer_id"],
        "phone_number":   cust["phone_number"],
        "full_name":      cust["full_name"],
        "location":       location,
        "mean_amount":    round(float(stats["mean_amount"]), 2),
        "std_amount":     round(float(stats["std_amount"]), 2),
        "txns_per_day":   txns_per_day,
        "terminals_used": stats["terminals_used"] or 0,
        "total_txns":     total_txns,
        "risk_score":     _compute_risk_score(
                              stats["avg_fraud_probability"], stats["confirmed_fraud_count"], total_txns
                          ),
        "recent_transactions": recent_transactions,
    }


@router.get("/reports")
async def list_customer_reports(_: dict = Depends(get_current_admin)):
    """Get all customer reports (unauthorized reports and OTP declines)."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT transaction_id, customer_id, terminal_id, tx_amount, tx_datetime,
                   scenario_id, scenario_name, status, top_reason
            FROM transactions
            WHERE status IN ('REPORTED_FRAUD', 'DECLINED')
            ORDER BY tx_datetime DESC
            """
        )

    reports = []
    for r in rows:
        status = r["status"]
        scenario = r["scenario_name"] or "Suspicious Charge"

        if status == 'REPORTED_FRAUD':
            msg = f"Reported unauthorized activity. Customer says: 'I did not authorize this transaction. I suspect my card was skimmed at Terminal {r['terminal_id']}.'"
        elif r["top_reason"] == 'OTP_NOT_ENTERED':
            msg = f"OTP Verification Timed Out. Transaction auto-declined. Customer failed to enter verification code within the 40-second safety window."
        else:
            msg = f"OTP Verification Failed. Customer entered incorrect validation code. Suspicious attempt blocked."

        reports.append({
            "transaction_id": r["transaction_id"],
            "customer_id": r["customer_id"],
            "terminal_id": r["terminal_id"],
            "amount": float(r["tx_amount"]),
            "scenario": scenario,
            "status": status,
            "timestamp": r["tx_datetime"].isoformat(),
            "customer_statement": msg
        })
    return reports


@router.websocket("/ws")
async def dashboard_ws(ws: WebSocket, token: str | None = Query(default=None)):
    """
    WebSocket endpoint — admin dashboard connects here for live events.

    Browsers can't attach an Authorization header to a WebSocket handshake,
    so the admin JWT is passed as `?token=...` instead (same token the
    dashboard got back from POST /api/auth/login). Connections without a
    valid admin token are closed immediately rather than accepted.
    """
    if not token:
        await ws.close(code=4401)
        return
    try:
        payload = decode_token(token)
    except JWTError:
        await ws.close(code=4401)
        return
    if payload.get("role") != "admin":
        await ws.close(code=4403)
        return

    await ws_manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)