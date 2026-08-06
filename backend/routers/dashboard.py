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
import httpx
from datetime import datetime, timezone, timedelta

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
        parsed = value
    else:
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError):
            return []

    if isinstance(parsed, list):
        out = []
        for item in parsed:
            if isinstance(item, dict):
                val = item.get("impact") if item.get("impact") is not None else item.get("shap_value", 0.0)
                item["impact"] = float(val) if val is not None else 0.0
                item["shap_value"] = float(val) if val is not None else 0.0
                out.append(item)
        return out
    return parsed



from backend.routers.auth import get_current_admin, _sanitize_for_json


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
        return _sanitize_for_json(get_customer_state(customer_id))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

@router.get("/metrics")
async def get_metrics(_: dict = Depends(get_current_admin)):
    """Aggregated KPI snapshot for the top KPI cards."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        now = datetime.now(timezone.utc)
        since_30d = now - timedelta(days=30)
        since_24h = now - timedelta(hours=24)

        total_tx = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE tx_datetime >= $1", since_30d)
        volume = await conn.fetchval("SELECT COALESCE(SUM(tx_amount), 0) FROM transactions WHERE tx_datetime >= $1", since_30d)
        fraud_detected = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE is_fraud = TRUE AND tx_datetime >= $1", since_30d)
        confirmed_fraud = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE status = 'DECLINED' AND tx_datetime >= $1", since_30d)
        legitimate = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE status = 'APPROVED' AND tx_datetime >= $1", since_30d)
        false_positives = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE status = 'VERIFIED' AND tx_datetime >= $1", since_30d)
        active_customers = await conn.fetchval("SELECT COUNT(DISTINCT customer_id) FROM transactions WHERE tx_datetime >= $1", since_30d)
        active_terminals = await conn.fetchval("SELECT COUNT(DISTINCT terminal_id) FROM transactions WHERE tx_datetime >= $1", since_30d)

        # Fallback to all-time if database has transactions prior to 30d
        if not total_tx:
            total_tx = await conn.fetchval("SELECT COUNT(*) FROM transactions")
            volume = await conn.fetchval("SELECT COALESCE(SUM(tx_amount), 0) FROM transactions")
            fraud_detected = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE is_fraud = TRUE")
            confirmed_fraud = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE status = 'DECLINED'")
            legitimate = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE status = 'APPROVED'")
            false_positives = await conn.fetchval("SELECT COUNT(*) FROM transactions WHERE status = 'VERIFIED'")
            active_customers = await conn.fetchval("SELECT COUNT(DISTINCT customer_id) FROM transactions")
            active_terminals = await conn.fetchval("SELECT COUNT(DISTINCT terminal_id) FROM transactions")

        registered_customers = await conn.fetchval("SELECT COUNT(*) FROM customers")
        registered_terminals = await conn.fetchval("SELECT COUNT(*) FROM terminals")

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
            since_24h,
        )

        scenarios = await conn.fetch(
            """
            SELECT scenario_name, COUNT(*) AS cnt
            FROM transactions
            WHERE is_fraud = TRUE AND scenario_name IS NOT NULL AND tx_datetime >= $1
            GROUP BY scenario_name ORDER BY cnt DESC
            """,
            since_30d,
        )

        top_reasons = await conn.fetch(
            """
            SELECT top_reason, COUNT(*) AS cnt
            FROM transactions
            WHERE is_fraud = TRUE AND top_reason IS NOT NULL AND tx_datetime >= $1
            GROUP BY top_reason ORDER BY cnt DESC LIMIT 5
            """,
            since_30d,
        )

        otp_sent = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE is_fraud = TRUE AND tx_datetime >= $1", since_30d
        )
        otp_verified = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status = 'VERIFIED' AND tx_datetime >= $1", since_30d
        )

    fraud_rate = float(fraud_detected / total_tx) if total_tx else 0.0

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
                   top_reason, status, shap_explanation, llm_report
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


@router.post("/transactions/{transaction_id}/generate-report")
async def generate_llm_report(transaction_id: str, _: dict = Depends(get_current_admin)):
    """
    Generate an AI incident report for a specific transaction using
    OpenRouter (LLM).  The report is persisted in the `llm_report`
    column so subsequent requests return the cached version instantly.
    """
    api_key = os.environ.get("OPEN_ROUTER_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPEN_ROUTER_API_KEY not configured on the server.")

    # ── Fetch transaction context ────────────────────────────────────────
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT transaction_id, customer_id, terminal_id, tx_amount, tx_datetime,
                   is_fraud, fraud_probability, scenario_id, scenario_name,
                   top_reason, status, shap_explanation, llm_report
            FROM transactions
            WHERE transaction_id = $1
            """,
            transaction_id,
        )
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    tx = dict(row)

    # Return cached report if it already exists
    if tx.get("llm_report"):
        return {"llm_report": tx["llm_report"], "cached": True}

    # ── Build the context for the LLM ────────────────────────────────────
    shap_data = _parse_shap(tx.get("shap_explanation"))
    shap_summary = "\n".join(
        f"  - {item.get('feature', 'Unknown')}: SHAP value {item.get('shap_value', item.get('impact', 0)):.4f} ({item.get('type', 'fraud')})"
        for item in (shap_data if isinstance(shap_data, list) else [])
    ) or "  No SHAP data available."

    tx_datetime_str = str(tx.get("tx_datetime", "Unknown"))

    user_prompt = f"""Analyze the following transaction and write a professional explanation or report:

**Transaction Details:**
- Transaction ID: {tx['transaction_id']}
- Customer ID: {tx['customer_id']}
- Terminal ID: {tx['terminal_id']}
- Amount: ${float(tx['tx_amount']):.2f}
- Date/Time: {tx_datetime_str}
- Fraud Probability: {float(tx.get('fraud_probability', 0)) * 100:.1f}%
- Model Decision: {'FRAUDULENT' if tx.get('is_fraud') else 'LEGITIMATE'}
- Fraud Scenario: {tx.get('scenario_name') or 'None detected'}
- Current Status: {tx.get('status', 'UNKNOWN')}
- Top Flagging Reason: {tx.get('top_reason') or 'N/A'}

**SHAP Feature Contributions:**
{shap_summary}

Please write a concise but thorough report covering:
1. Executive Summary (2-3 sentences explaining if the transaction is indeed suspicious or confirmed safe)
2. Risk/Safety Assessment (severity level and confidence)
3. Key Contributing Factors (based on SHAP values. Note: Positive values increase risk, negative values indicate normal/safe behavior)
4. Recommended Actions
5. Conclusion"""

    system_prompt = """You are a Senior Financial Fraud Analyst at a major bank's fraud investigation unit.
You write clear, professional incident reports or legitimacy clearance notes.
IMPORTANT: Understand that:
- Positive SHAP values indicate features that increase the likelihood of fraud (Risk factors).
- Negative SHAP values indicate features that decrease the likelihood of fraud (Legitimate/Safe indicators).
Do not call a legitimate transaction 'Suspicious' or assign a 'Medium/High' severity to a transaction with low fraud probability (e.g. < 5.0%). For low-probability transactions, write a 'Legitimacy Clearance Note' instead of an 'Incident Report' and explain why it is safe, referencing negative SHAP values as safety drivers.
Use markdown formatting. Be precise and data-driven."""

    # ── Call OpenRouter API with Fallback Models ────────────────────────
    # Try active free models on OpenRouter, falling back to paid slug if needed
    candidate_models = [
        os.environ.get("OPEN_ROUTER_MODEL", "").strip(),
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "meta-llama/llama-3.3-70b-instruct:free",
        "deepseek/deepseek-r1:free",
        "qwen/qwen-2.5-72b-instruct:free",
        "meta-llama/llama-3.1-8b-instruct",
    ]
    candidate_models = [m for m in candidate_models if m]

    data = None
    last_err = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for model in candidate_models:
            try:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000",
                        "X-Title": "Sentinel Fraud Detection System",
                    },
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user",   "content": user_prompt},
                        ],
                        "max_tokens": 1024,
                        "temperature": 0.3,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    break
                else:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:300]}"
            except Exception as exc:
                last_err = str(exc)

    if data is None:
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter API failed for all models: {last_err}",
        )

    report_text = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "Report generation failed — no content returned.")
    )

    # ── Persist the report ────────────────────────────────────────────────
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE transactions SET llm_report = $2 WHERE transaction_id = $1",
            transaction_id,
            report_text,
        )

    return {"llm_report": report_text, "cached": False}


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
                COALESCE(AVG(tx_amount) FILTER (WHERE status IN ('APPROVED', 'VERIFIED')), 0)        AS mean_amount,
                COALESCE(STDDEV_POP(tx_amount) FILTER (WHERE status IN ('APPROVED', 'VERIFIED')), 0) AS std_amount,
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


# ---------------------------------------------------------------------------
# GET /api/dashboard/analytics/charts
# ---------------------------------------------------------------------------
@router.get("/analytics/charts")
async def get_analytics_charts(_: dict = Depends(get_current_admin)):
    """Aggregated analytics datasets for the React/Recharts frontend charts."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        now = datetime.now(timezone.utc)
        since_24h = now - timedelta(hours=24)
        since_30d = now - timedelta(days=30)

        # -- volume_series: hourly transaction counts for the last 24 h --
        volume_rows = await conn.fetch(
            """
            SELECT EXTRACT(HOUR FROM tx_datetime)::int AS hour,
                   COUNT(*) AS volume,
                   COUNT(*) FILTER (WHERE is_fraud = TRUE) AS fraud
            FROM transactions
            WHERE tx_datetime >= $1
            GROUP BY hour ORDER BY hour
            """,
            since_24h,
        )
        # Fill all 24 buckets so the chart always has a full x-axis
        vol_map = {r["hour"]: r for r in volume_rows}
        volume_series = [
            {"hour": h, "volume": vol_map[h]["volume"] if h in vol_map else 0,
             "fraud": vol_map[h]["fraud"] if h in vol_map else 0}
            for h in range(24)
        ]

        # -- weekday_series: fraud vs legit by day-of-week over last 30 d --
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekday_rows = await conn.fetch(
            """
            SELECT EXTRACT(DOW FROM tx_datetime)::int AS dow,
                   COUNT(*) FILTER (WHERE is_fraud = TRUE) AS fraud,
                   COUNT(*) FILTER (WHERE is_fraud = FALSE) AS legit
            FROM transactions
            WHERE tx_datetime >= $1
            GROUP BY dow ORDER BY dow
            """,
            since_30d,
        )
        # Postgres DOW: 0=Sun..6=Sat; remap to Mon=0..Sun=6
        wd_map = {r["dow"]: r for r in weekday_rows}
        weekday_series = []
        for iso_day in range(7):          # 0=Mon..6=Sun
            pg_dow = (iso_day + 1) % 7    # Mon->1, ..., Sun->0
            r = wd_map.get(pg_dow)
            weekday_series.append({
                "day": day_names[iso_day],
                "fraud": r["fraud"] if r else 0,
                "legit": r["legit"] if r else 0,
            })

        # -- prob_histogram: distribution of fraud_probability in 0.1-wide bins --
        hist_rows = await conn.fetch(
            """
            SELECT FLOOR(fraud_probability * 10) / 10.0 AS bin_start,
                   COUNT(*) AS count
            FROM transactions
            WHERE tx_datetime >= $1
              AND fraud_probability IS NOT NULL
            GROUP BY bin_start ORDER BY bin_start
            """,
            since_30d,
        )
        hist_map = {float(r["bin_start"]): r["count"] for r in hist_rows}
        prob_histogram = [
            {"bin": f"{b:.1f}-{b+0.1:.1f}", "count": hist_map.get(round(b, 1), 0)}
            for b in [i / 10 for i in range(10)]
        ]

        # -- otp_outcomes pie --
        verified = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status='VERIFIED' AND tx_datetime >= $1", since_30d
        )
        fp_corrected = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE is_fraud=TRUE AND status!='DECLINED' AND tx_datetime >= $1", since_30d
        )
        failed_otp = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status='DECLINED' AND tx_datetime >= $1", since_30d
        )
        otp_outcomes = [
            {"name": "Verified",     "value": verified,     "color": "#22C55E"},
            {"name": "FP Corrected", "value": fp_corrected, "color": "#06B6D4"},
            {"name": "Failed",       "value": failed_otp,   "color": "#EF4444"},
        ]

        # -- model_dist pie --
        legit_cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE is_fraud=FALSE AND tx_datetime >= $1", since_30d
        )
        suspicious_cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE is_fraud=TRUE AND status='PENDING_OTP' AND tx_datetime >= $1", since_30d
        )
        fraud_cnt = await conn.fetchval(
            "SELECT COUNT(*) FROM transactions WHERE status='DECLINED' AND tx_datetime >= $1", since_30d
        )
        model_dist = [
            {"name": "Legit",      "value": legit_cnt,      "color": "#2563EB"},
            {"name": "Suspicious", "value": suspicious_cnt, "color": "#F59E0B"},
            {"name": "Fraud",      "value": fraud_cnt,      "color": "#EF4444"},
        ]

        # -- top_scenarios: most common fraud scenario names last 30 d --
        scenario_rows = await conn.fetch(
            """
            SELECT scenario_name, COUNT(*) AS cnt
            FROM transactions
            WHERE is_fraud = TRUE
              AND tx_datetime >= $1
              AND scenario_name IS NOT NULL
            GROUP BY scenario_name
            ORDER BY cnt DESC
            LIMIT 8
            """,
            since_30d,
        )
        top_scenarios = [{"scenario_name": r["scenario_name"], "cnt": r["cnt"]} for r in scenario_rows]

        # -- hourly_fraud_rate: avg fraud probability by hour of day --
        hfr_rows = await conn.fetch(
            """
            SELECT EXTRACT(HOUR FROM tx_datetime)::int AS hour,
                   ROUND(AVG(fraud_probability)::numeric * 100, 1) AS rate
            FROM transactions
            WHERE tx_datetime >= $1
              AND fraud_probability IS NOT NULL
            GROUP BY hour ORDER BY hour
            """,
            since_30d,
        )
        hfr_map = {r["hour"]: float(r["rate"]) for r in hfr_rows}
        hourly_fraud_rate = [
            {"hour": str(h), "rate": hfr_map.get(h, 0.0)}
            for h in range(24)
        ]

    return {
        "volume_series":     volume_series,
        "weekday_series":    weekday_series,
        "prob_histogram":    prob_histogram,
        "otp_outcomes":      otp_outcomes,
        "model_dist":        model_dist,
        "top_scenarios":     top_scenarios,
        "hourly_fraud_rate": hourly_fraud_rate,
    }


# ---------------------------------------------------------------------------
# GET /api/dashboard/terminals/stats
# ---------------------------------------------------------------------------
@router.get("/terminals/stats")
async def get_terminal_stats(_: dict = Depends(get_current_admin)):
    """Per-terminal statistics for the terminal heat-map."""
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        now = datetime.now(timezone.utc)
        since_3d  = now - timedelta(days=3)
        since_7d  = now - timedelta(days=7)
        since_28d = now - timedelta(days=28)

        rows = await conn.fetch(
            """
            SELECT
                t.terminal_id,
                t.terminal_name,
                t.latitude,
                t.longitude,
                COUNT(tx.transaction_id)                                          AS total_txns,
                COUNT(tx.transaction_id) FILTER (WHERE tx.is_fraud = TRUE)        AS fraud_count,
                -- 3-day window
                COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $1)      AS cnt_3d,
                COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $1
                                                   AND tx.is_fraud = TRUE)        AS fraud_3d,
                -- 7-day window
                COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $2)      AS cnt_7d,
                COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $2
                                                   AND tx.is_fraud = TRUE)        AS fraud_7d,
                -- 28-day window
                COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $3)      AS cnt_28d,
                COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $3
                                                   AND tx.is_fraud = TRUE)        AS fraud_28d
            FROM terminals t
            LEFT JOIN transactions tx ON tx.terminal_id = t.terminal_id
            GROUP BY t.terminal_id, t.terminal_name, t.latitude, t.longitude
            ORDER BY t.terminal_id
            """,
            since_3d, since_7d, since_28d,
        )

    result = []
    for r in rows:
        total  = r["total_txns"]  or 0
        cnt_3d = r["cnt_3d"]      or 0
        cnt_7d = r["cnt_7d"]      or 0
        cnt_28d= r["cnt_28d"]     or 0

        rate_3d  = r["fraud_3d"]  / cnt_3d  if cnt_3d  else 0.0
        rate_7d  = r["fraud_7d"]  / cnt_7d  if cnt_7d  else 0.0
        rate_28d = r["fraud_28d"] / cnt_28d if cnt_28d else 0.0

        fraud_count = r["fraud_count"] or 0
        risk_score  = min(100, round(rate_7d * 300))

        result.append({
            "terminal_id":       r["terminal_id"],
            "terminal_name":     r["terminal_name"],
            "latitude":          float(r["latitude"]),
            "longitude":         float(r["longitude"]),
            "total_txns":        total,
            "fraud_count":       fraud_count,
            "fraud_rate_3d":     round(rate_3d,  4),
            "fraud_rate_7d":     round(rate_7d,  4),
            "fraud_rate_28d":    round(rate_28d, 4),
            "nearby_incidents":  fraud_count,
            "risk_score":        risk_score,
        })
    return result


# ---------------------------------------------------------------------------
# GET /api/dashboard/alerts
# ---------------------------------------------------------------------------
@router.get("/alerts")
async def get_alerts(_: dict = Depends(get_current_admin)):
    """Real-time alert feed derived from live transaction data."""
    pool = await get_db_pool()
    now = datetime.now(timezone.utc)
    alerts: list[dict] = []

    def _ago(ts) -> str:
        """Return human-readable relative time string."""
        if ts is None:
            return "recently"
        # ts may be tz-naive from DB; force UTC
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        diff = int((now - ts).total_seconds())
        if diff < 60:
            return f"{diff}s ago"
        if diff < 3600:
            return f"{diff // 60}m ago"
        if diff < 86400:
            return f"{diff // 3600}h ago"
        return f"{diff // 86400}d ago"

    async with pool.acquire() as conn:
        # 1. High-probability fraud transactions (last 24 h)
        hp_rows = await conn.fetch(
            """
            SELECT transaction_id, fraud_probability, tx_datetime
            FROM transactions
            WHERE tx_datetime >= $1
              AND status IN ('DECLINED', 'PENDING_OTP')
              AND fraud_probability IS NOT NULL
            ORDER BY fraud_probability DESC
            LIMIT 5
            """,
            now - timedelta(hours=24),
        )
        for r in hp_rows:
            tx_id = str(r["transaction_id"])
            prob  = float(r["fraud_probability"])
            alerts.append({
                "id":       f"hp_{tx_id}",
                "type":     "high_prob",
                "severity": "danger",
                "message":  f"TX {tx_id[:8]} flagged with {prob*100:.0f}% fraud probability",
                "time":     _ago(r["tx_datetime"]),
                "_ts":      r["tx_datetime"],
            })

        # 2. High-risk terminals (fraud_rate_7d > 15 %)
        term_rows = await conn.fetch(
            """
            SELECT t.terminal_id,
                   COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $1)                  AS cnt_7d,
                   COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $1
                                                      AND tx.is_fraud = TRUE)                    AS fraud_7d,
                   MAX(tx.tx_datetime) FILTER (WHERE tx.is_fraud = TRUE
                                               AND tx.tx_datetime >= $1)                         AS last_fraud
            FROM terminals t
            LEFT JOIN transactions tx ON tx.terminal_id = t.terminal_id
            GROUP BY t.terminal_id
            HAVING COUNT(tx.transaction_id) FILTER (WHERE tx.tx_datetime >= $1) > 0
            """,
            now - timedelta(days=7),
        )
        for r in term_rows:
            cnt   = r["cnt_7d"]   or 0
            fraud = r["fraud_7d"] or 0
            rate  = fraud / cnt if cnt else 0.0
            if rate > 0.15:
                term_id = str(r["terminal_id"])
                alerts.append({
                    "id":       f"term_{term_id}",
                    "type":     "high_risk_terminal",
                    "severity": "warning",
                    "message":  f"Terminal {term_id} fraud rate spiked to {rate*100:.0f}%",
                    "time":     _ago(r["last_fraud"]),
                    "_ts":      r["last_fraud"],
                })

        # 3. Rapid transactions — customers with 5+ txns in last 2 minutes
        rapid_rows = await conn.fetch(
            """
            SELECT customer_id, COUNT(*) AS cnt, MAX(tx_datetime) AS last_tx
            FROM transactions
            WHERE tx_datetime >= $1
            GROUP BY customer_id
            HAVING COUNT(*) >= 5
            ORDER BY cnt DESC
            LIMIT 5
            """,
            now - timedelta(minutes=2),
        )
        for r in rapid_rows:
            cid = str(r["customer_id"])
            alerts.append({
                "id":       f"rapid_{cid}",
                "type":     "rapid_tx",
                "severity": "warning",
                "message":  f"Customer {cid} made {r['cnt']} transactions in the last 2 minutes",
                "time":     _ago(r["last_tx"]),
                "_ts":      r["last_tx"],
            })

        # 4. OTP failures in the last hour
        otp_rows = await conn.fetch(
            """
            SELECT transaction_id, tx_datetime
            FROM transactions
            WHERE status = 'DECLINED'
              AND tx_datetime >= $1
            ORDER BY tx_datetime DESC
            LIMIT 5
            """,
            now - timedelta(hours=1),
        )
        for r in otp_rows:
            tx_id = str(r["transaction_id"])
            alerts.append({
                "id":       f"otp_{tx_id}",
                "type":     "otp_failed",
                "severity": "danger",
                "message":  f"OTP verification failed for TX {tx_id[:8]}",
                "time":     _ago(r["tx_datetime"]),
                "_ts":      r["tx_datetime"],
            })

    # Sort by timestamp descending (None sorts last), deduplicate by id, limit 20
    seen: set[str] = set()
    unique: list[dict] = []
    def _sort_key(a):
        ts = a["_ts"]
        if ts is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)

    alerts.sort(key=_sort_key, reverse=True)
    for a in alerts:
        if a["id"] not in seen:
            seen.add(a["id"])
            unique.append({k: v for k, v in a.items() if k != "_ts"})
        if len(unique) >= 20:
            break
    return unique



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

    await ws_manager.connect(ws)
    try:
        while True:
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)