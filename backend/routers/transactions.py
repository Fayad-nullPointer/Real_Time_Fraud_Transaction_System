"""
routers/transactions.py
=======================
POST /api/transactions/create  – initiate a transaction (runs ML inference)
POST /api/transactions/verify  – verify OTP for a pending transaction
GET  /api/transactions/history – authenticated customer's transaction history
POST /api/transactions/decline – called when the OTP countdown expires
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.db.postgres import get_db_pool
from backend.db.redis_client import (
    count_customer_tx, count_terminal_distinct_customers,
    count_terminal_tx, get_customer_lags,
    get_redis, push_customer_lag, push_customer_tx_time,
    push_terminal_event, store_otp, verify_otp,
)
from backend.core.pipeline_wrapper import generate_otp, score_transaction
from backend.core.ws_manager import ws_manager
from backend.routers.auth import get_current_customer

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateTxRequest(BaseModel):
    terminal_id: int
    tx_amount: float
    lat: float | None = None
    lon: float | None = None


class VerifyOTPRequest(BaseModel):
    transaction_id: str
    otp_code: str


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/create")
async def create_transaction(
    body: CreateTxRequest,
    customer_id: int = Depends(get_current_customer),
):
    pool = await get_db_pool()
    now = datetime.now(timezone.utc)
    tx_id = str(uuid.uuid4())

    # Fetch customer phone & terminal profile
    async with pool.acquire() as conn:
        customer = await conn.fetchrow(
            "SELECT phone_number FROM customers WHERE customer_id = $1", customer_id
        )
        terminal = await conn.fetchrow(
            "SELECT terminal_id FROM terminals WHERE terminal_id = $1 AND is_active = TRUE",
            body.terminal_id,
        )

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")
    if not terminal:
        raise HTTPException(status_code=404, detail="Terminal not found or inactive.")

    # Build raw velocity features from Redis
    lags = await get_customer_lags(customer_id)
    tx_count_1h = await count_customer_tx(customer_id, 3600)
    tx_count_4h = await count_customer_tx(customer_id, 14400)
    terminal_tx_1h = await count_terminal_tx(body.terminal_id, 3600)
    terminal_tx_4h = await count_terminal_tx(body.terminal_id, 14400)
    terminal_distinct_1h = await count_terminal_distinct_customers(body.terminal_id)

    # Build transaction dict for the ML pipeline
    tx_dict = {
        "TRANSACTION_ID": tx_id,
        "CUSTOMER_ID":    customer_id,
        "TERMINAL_ID":    body.terminal_id,
        "TX_DATETIME":    now.strftime("%Y-%m-%d %H:%M:%S"),
        "TX_AMOUNT":      body.tx_amount,
        "PHONE_NUMBER":   customer["phone_number"],
        # pre-computed velocity hints (pipeline will use its own state too)
        "_redis_tx_count_1h":            tx_count_1h,
        "_redis_tx_count_4h":            tx_count_4h,
        "_redis_terminal_tx_count_1h":   terminal_tx_1h,
        "_redis_terminal_tx_count_4h":   terminal_tx_4h,
        "_redis_distinct_customers_1h":  terminal_distinct_1h,
        "_redis_lags":                   lags,
    }

    # Run ML inference (synchronous — runs in thread pool via FastAPI).
    # Also returns "top_reasons": a compact, ranked list of the SHAP feature
    # contributions behind this fraud_probability — see pipeline_wrapper.py.
    result = score_transaction(tx_dict)

    result = {
        **result,
        "is_fraud": bool(result["is_fraud"]),
        "fraud_probability": float(result["fraud_probability"]),
        "scenario_id": (
            int(result["scenario_id"])
            if result["scenario_id"] is not None
            else None
        ),
    }

    initial_status = "PENDING_OTP" if result["is_fraud"] else "APPROVED"

    # Persist transaction to PostgreSQL (including its SHAP explanation, so
    # the dashboard can show "why" when an admin clicks into this
    # transaction later — see GET /api/dashboard/transactions/{id}).
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO transactions (
                transaction_id, customer_id, terminal_id, tx_amount, tx_datetime,
                user_lat, user_lon, is_fraud, fraud_probability,
                scenario_id, scenario_name, top_reason, status, shap_explanation
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            """,
            tx_id, customer_id, body.terminal_id, body.tx_amount, now,
            body.lat, body.lon,
            result["is_fraud"], result["fraud_probability"],
            result["scenario_id"], result["scenario_name"],
            result["top_reason"], initial_status,
            json.dumps(result.get("top_reasons", [])),
        )

    # Update Redis velocity state (only for approved transactions)
    if not result["is_fraud"]:
        await push_customer_lag(customer_id, body.tx_amount)
        await push_customer_tx_time(customer_id, tx_id, now.timestamp())
        await push_terminal_event(body.terminal_id, customer_id, tx_id, now.timestamp())

    # Broadcast to dashboard WebSocket (top_reasons included so the live
    # event feed / logs view can show "why" without a follow-up fetch).
    await ws_manager.broadcast({
        "event":              "TRANSACTION",
        "transaction_id":     tx_id,
        "customer_id":        customer_id,
        "terminal_id":        body.terminal_id,
        "amount":             body.tx_amount,
        "fraud_probability":  result["fraud_probability"],
        "is_fraud":           result["is_fraud"],
        "scenario_name":      result["scenario_name"],
        "top_reason":         result["top_reason"],
        "top_reasons":        result.get("top_reasons", []),
        "status":             initial_status,
        "timestamp":          now.isoformat(),
    })

    if result["is_fraud"]:
        # Generate and store OTP, Twilio alert is sent inside pipeline
        otp = generate_otp()
        await store_otp(tx_id, otp)
        return {
            "transaction_id": tx_id,
            "status": "PENDING_OTP",
            "message": "Suspicious activity detected. A verification code was sent to your WhatsApp.",
            "fraud_probability": result["fraud_probability"],
            "scenario": result["scenario_name"],
        }

    return {
        "transaction_id": tx_id,
        "status": "APPROVED",
        "message": "Transaction approved.",
    }


@router.post("/verify")
async def verify_transaction(
    body: VerifyOTPRequest,
    customer_id: int = Depends(get_current_customer),
):
    pool = await get_db_pool()

    # Validate ownership
    async with pool.acquire() as conn:
        tx = await conn.fetchrow(
            "SELECT customer_id, terminal_id, tx_amount, tx_datetime, status FROM transactions WHERE transaction_id = $1",
            body.transaction_id,
        )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["customer_id"] != customer_id:
        raise HTTPException(status_code=403, detail="Not your transaction.")
    if tx["status"] != "PENDING_OTP":
        raise HTTPException(status_code=400, detail=f"Transaction is already in status '{tx['status']}'.")

    otp_valid = await verify_otp(body.transaction_id, body.otp_code)

    new_status = "VERIFIED" if otp_valid else "DECLINED"

    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE transactions SET status = $1 WHERE transaction_id = $2",
            new_status, body.transaction_id,
        )

    if otp_valid:
        # Now update Redis velocity (transaction approved by user)
        await push_customer_lag(customer_id, tx["tx_amount"])
        await push_customer_tx_time(customer_id, body.transaction_id, tx["tx_datetime"].timestamp())
        await push_terminal_event(tx["terminal_id"], customer_id, body.transaction_id, tx["tx_datetime"].timestamp())

    await ws_manager.broadcast({
        "event":          "OTP_RESULT",
        "transaction_id": body.transaction_id,
        "customer_id":    customer_id,
        "status":         new_status,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    })

    if otp_valid:
        return {"status": "VERIFIED", "message": "Transaction verified and approved."}
    raise HTTPException(status_code=400, detail="Invalid or expired OTP. Transaction declined.")


@router.get("/history")
async def transaction_history(
    customer_id: int = Depends(get_current_customer),
    limit: int = 20,
):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT transaction_id, terminal_id, tx_amount, tx_datetime,
                   is_fraud, fraud_probability, scenario_name, status
            FROM transactions
            WHERE customer_id = $1
            ORDER BY tx_datetime DESC
            LIMIT $2
            """,
            customer_id, limit,
        )
    return [dict(r) for r in rows]

def _parse_shap_reasons(value) -> list[dict]:
    """shap_explanation is stored as JSONB; asyncpg may hand it back as a
    str or an already-decoded list depending on driver/codec setup —
    normalize to a Python list either way."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError):
        return []


@router.post("/decline")
async def decline_transaction(
    body: VerifyOTPRequest,          # reuses same schema — only transaction_id used
    customer_id: int = Depends(get_current_customer),
):
    """
    Called by the client when the OTP countdown expires.
    Flags the transaction as fraud (status -> DECLINED) and records
    "OTP_NOT_ENTERED" as a reason alongside the original SHAP-derived
    top reasons, so the dashboard's per-transaction detail view shows
    both "why the model flagged it" AND "why it was ultimately declined".
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        tx = await conn.fetchrow(
            "SELECT customer_id, status, shap_explanation FROM transactions WHERE transaction_id = $1",
            body.transaction_id,
        )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["customer_id"] != customer_id:
        raise HTTPException(status_code=403, detail="Not your transaction.")
    if tx["status"] != "PENDING_OTP":
        # Already resolved — idempotent, just return ok
        return {"status": tx["status"], "message": "Transaction already resolved."}

    # Prepend the OTP-timeout reason to the existing ranked SHAP reasons
    # (rather than replacing them) so both the model's original evidence
    # and the customer's failure to verify are visible together.
    existing_reasons = _parse_shap_reasons(tx["shap_explanation"])
    otp_reason = {"feature": "OTP_NOT_ENTERED", "shap_value": None, "type": "otp"}
    updated_reasons = [otp_reason] + existing_reasons

    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE transactions
            SET status = 'DECLINED', is_fraud = TRUE,
                top_reason = 'OTP_NOT_ENTERED', shap_explanation = $2
            WHERE transaction_id = $1
            """,
            body.transaction_id, json.dumps(updated_reasons),
        )

    # Delete any leftover OTP from Redis
    r = get_redis()
    await r.delete(f"otp:{body.transaction_id}")

    await ws_manager.broadcast({
        "event":          "OTP_RESULT",
        "transaction_id": body.transaction_id,
        "customer_id":    customer_id,
        "status":         "DECLINED",
        "is_fraud":       True,
        "reason":         "OTP_TIMEOUT",
        "top_reason":     "OTP_NOT_ENTERED",
        "top_reasons":    updated_reasons,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    })

    return {"status": "DECLINED", "message": "OTP timed out. Transaction flagged as fraud."}