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
from backend.db.redis_client import get_redis, store_otp, verify_otp
from backend.core.ws_manager import ws_manager
from backend.routers.auth import get_current_customer
import asyncio
from datetime import datetime, timedelta, timezone
from backend.db.realtime_csv import append_transaction, update_transaction_label, retro_propagate_skimming

from logger import get_logger
from backend.core.pipeline_wrapper import generate_otp, get_pipeline, score_transaction, lookup_ground_truth, ensure_customer_warmed

logger = get_logger("transactions")

OTP_TTL_SECONDS = 40   # was effectively 300s (Redis TTL) / 5min (frontend timer)

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


class SimulateTxRequest(BaseModel):
    transaction_id: str | int
    customer_id: int
    terminal_id: int
    tx_amount: float
    tx_datetime: str


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

    # Build transaction dict for the ML pipeline
    tx_dict = {
        "TRANSACTION_ID": tx_id,
        "CUSTOMER_ID":    customer_id,
        "TERMINAL_ID":    body.terminal_id,
        "TX_DATETIME":    now.strftime("%Y-%m-%d %H:%M:%S"),
        "TX_AMOUNT":      body.tx_amount,
        "PHONE_NUMBER":   customer["phone_number"],
    }

    # Ensure customer's recent history is warm-started from DB before scoring
    await ensure_customer_warmed(customer_id)

    # Run ML inference (LightGBM + SHAP + a synchronous Twilio call on
    # fraud) in a worker thread so it never blocks the event loop —
    # other requests and the dashboard WebSocket keep flowing while this
    # transaction scores.
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, score_transaction, tx_dict)

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

    # Look up ground truth from synthetic_fraud_transactions.csv
    gt_fraud, gt_scenario = lookup_ground_truth(customer_id, body.terminal_id, body.tx_amount)

    initial_status = "PENDING_OTP" if result["is_fraud"] else "APPROVED"
    final_is_fraud = result["is_fraud"]
    final_scenario_id = result["scenario_id"]
    final_scenario_name = result["scenario_name"]

    # False Negative (Customer Feedback Loop triggered on ground truth matching)
    if not result["is_fraud"] and gt_fraud == 1:
        initial_status = "REPORTED_FRAUD"
        final_is_fraud = True
        final_scenario_id = gt_scenario if gt_scenario > 0 else 2
        final_scenario_name = {1: "Large Amount", 2: "Terminal Skimming", 3: "Credential Takeover"}.get(final_scenario_id, "Terminal Skimming")

        logger.warning(
            f"[bold yellow][FEEDBACK] Customer {customer_id} noticed unauthorized activity from Terminal {body.terminal_id} and filed a report.[/bold yellow]",
            extra={
                "event_type": "CUSTOMER_FEEDBACK",
                "customer_id": customer_id,
                "terminal_id": body.terminal_id,
                "transaction_id": tx_id
            }
        )

        if final_scenario_id == 2:
            try:
                pipeline = get_pipeline()
                pipeline.compromise_terminal(body.terminal_id)
                compromise_start = now.strftime("%Y-%m-%d %H:%M:%S")
                retro_propagate_skimming(body.terminal_id, compromise_start)
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE transactions
                        SET is_fraud = TRUE, scenario_id = 2, scenario_name = 'Terminal Skimming'
                        WHERE terminal_id = $1 AND tx_datetime >= $2
                        """,
                        body.terminal_id, now
                    )
            except Exception as e:
                logger.error(f"Failed to compromise terminal and retro-propagate on ground truth match: {e}")

    otp_expires_at = (
        datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS)
        if result["is_fraud"] else None
    )

    # Persist transaction to PostgreSQL (including its SHAP explanation, so
    # the dashboard can show "why" when an admin clicks into this
    # transaction later — see GET /api/dashboard/transactions/{id}).
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO transactions (
                transaction_id, customer_id, terminal_id, tx_amount, tx_datetime,
                user_lat, user_lon, is_fraud, fraud_probability,
                scenario_id, scenario_name, top_reason, status, shap_explanation,
                otp_expires_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
            """,
            tx_id, customer_id, body.terminal_id, body.tx_amount, now,
            body.lat, body.lon,
            final_is_fraud, result["fraud_probability"],
            final_scenario_id, final_scenario_name,
            result["top_reason"], initial_status,
            json.dumps(result.get("top_reasons", [])),
            otp_expires_at,
        )

    # Append to realtime transactions CSV file for retraining
    append_transaction(
        tx_dict,
        is_fraud=final_is_fraud,
        scenario_id=final_scenario_id
    )

    # Broadcast to dashboard WebSocket (top_reasons included so the live
    # event feed / logs view can show "why" without a follow-up fetch).
    await ws_manager.broadcast({
        "event":              "TRANSACTION",
        "transaction_id":     tx_id,
        "customer_id":        customer_id,
        "terminal_id":        body.terminal_id,
        "amount":             body.tx_amount,
        "fraud_probability":  result["fraud_probability"],
        "is_fraud":           final_is_fraud,
        "scenario_name":      final_scenario_name,
        "top_reason":         result["top_reason"],
        "top_reasons":        result.get("top_reasons", []),
        "status":             initial_status,
        "timestamp":          now.isoformat(),
    })

    if result["is_fraud"]:
        # Generate and store OTP, Twilio alert is sent inside pipeline
        otp = generate_otp()
        await store_otp(tx_id, otp, ttl=OTP_TTL_SECONDS)
        return {
            "transaction_id": tx_id,
            "status": "PENDING_OTP",
            "message": "Suspicious activity detected. A verification code was sent to your WhatsApp.",
            "fraud_probability": result["fraud_probability"],
            "scenario": result["scenario_name"],
            "otp_expires_in": OTP_TTL_SECONDS,
        }

    return {
        "transaction_id": tx_id,
        "status": "APPROVED",
        "message": "Transaction approved.",
        "fraud_probability": result["fraud_probability"],
        "scenario": result.get("scenario_name"),
        "top_reason": result.get("top_reason"),
        "top_reasons": result.get("top_reasons", []),
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
            "SELECT customer_id, terminal_id, tx_amount, tx_datetime, status, scenario_id FROM transactions WHERE transaction_id = $1",
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

    # Update CSV label
    is_fraud = not otp_valid
    scenario_id = tx["scenario_id"] if not otp_valid else 0
    update_transaction_label(body.transaction_id, is_fraud=is_fraud, scenario_id=scenario_id)

    # If declined and scenario is 2 (Terminal Skimming), blacklist and retro-propagate
    if not otp_valid and tx["scenario_id"] == 2:
        try:
            pipeline = get_pipeline()
            pipeline.compromise_terminal(tx["terminal_id"])
            compromise_start = tx["tx_datetime"].strftime("%Y-%m-%d %H:%M:%S")
            retro_propagate_skimming(tx["terminal_id"], compromise_start)
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE transactions
                    SET is_fraud = TRUE, scenario_id = 2, scenario_name = 'Terminal Skimming'
                    WHERE terminal_id = $1 AND tx_datetime >= $2
                    """,
                    tx["terminal_id"], tx["tx_datetime"]
                )
        except Exception as e:
            logger.error(f"Failed to compromise terminal and retro-propagate: {e}")

    await ws_manager.broadcast({
        "event":          "OTP_RESULT",
        "transaction_id": body.transaction_id,
        "customer_id":    customer_id,
        "status":         new_status,
        "timestamp":      datetime.now(timezone.utc).isoformat(),
    })

    if otp_valid:
        logger.info(
            f"OTP verified for TX {body.transaction_id}.",
            extra={"event_type": "OTP_VERIFIED", "customer_id": customer_id,
                   "transaction_id": body.transaction_id, "status": "VERIFIED"},
        )
    else:
        logger.warning(
            f"OTP verification failed for TX {body.transaction_id} — incorrect code entered.",
            extra={"event_type": "OTP_FAILED", "customer_id": customer_id,
                   "transaction_id": body.transaction_id, "status": "DECLINED"},
        )

    if otp_valid:
        return {"status": "VERIFIED", "message": "Transaction verified and approved."}
    raise HTTPException(status_code=400, detail="Invalid or expired OTP. Transaction declined.")


class OtpPendingRequest(BaseModel):
    transaction_id: str

@router.post("/otp-pending")
async def mark_otp_pending(
    body: OtpPendingRequest,
    customer_id: int = Depends(get_current_customer),
):
    """
    Called when the customer closes/cancels the OTP dialog WITHOUT the
    verification window expiring. This is NOT a fraud signal — it never
    touches the transaction's status. It only records that the customer
    is still mid-verification, so the Logs tab / live feed can show
    "customer pending" distinctly from an actual OTP timeout.
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        tx = await conn.fetchrow(
            "SELECT customer_id, status FROM transactions WHERE transaction_id = $1",
            body.transaction_id,
        )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["customer_id"] != customer_id:
        raise HTTPException(status_code=403, detail="Not your transaction.")

    if tx["status"] == "PENDING_OTP":
        logger.info(
            f"Customer paused OTP entry for TX {body.transaction_id} — still pending, not fraud.",
            extra={
                "event_type": "CUSTOMER_OTP_PENDING",
                "customer_id": customer_id,
                "transaction_id": body.transaction_id,
                "status": "PENDING_OTP",
            },
        )
        await ws_manager.broadcast({
            "event": "OTP_PENDING",
            "transaction_id": body.transaction_id,
            "customer_id": customer_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    return {"status": tx["status"], "message": "Noted — you can resume verification any time before it times out."}


class ResumeOTPRequest(BaseModel):
    transaction_id: str


@router.post("/resume")
async def resume_otp(
    body: ResumeOTPRequest,
    customer_id: int = Depends(get_current_customer),
):
    """
    Re-opens a still-PENDING_OTP transaction so the customer can enter the
    code again after cancelling/closing the dialog earlier. Issues a fresh
    OTP with a brand-new OTP_TTL_SECONDS window and re-sends it via
    WhatsApp. Fails cleanly if the transaction was already resolved
    (verified, declined, or already timed out by the server-side sweep).
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        tx = await conn.fetchrow(
            """SELECT customer_id, terminal_id, tx_amount, status,
                      fraud_probability, scenario_name
               FROM transactions WHERE transaction_id = $1""",
            body.transaction_id,
        )
        customer = await conn.fetchrow(
            "SELECT phone_number FROM customers WHERE customer_id = $1", customer_id
        )

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["customer_id"] != customer_id:
        raise HTTPException(status_code=403, detail="Not your transaction.")
    if tx["status"] != "PENDING_OTP":
        raise HTTPException(
            status_code=400,
            detail=f"Transaction is already resolved (status '{tx['status']}') — nothing to resume.",
        )

    otp = generate_otp()
    await store_otp(body.transaction_id, otp, ttl=OTP_TTL_SECONDS)

    new_expiry = datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS)
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE transactions SET otp_expires_at = $2 WHERE transaction_id = $1",
            body.transaction_id, new_expiry,
        )

    if customer:
        try:
            pipeline = get_pipeline()
            if pipeline.notifier is not None:
                pipeline.notifier.send_fraud_alert(
                    to_phone_number=customer["phone_number"],
                    transaction_id=body.transaction_id,
                    tx_amount=float(tx["tx_amount"]),
                    terminal_id=str(tx["terminal_id"]),
                )
        except RuntimeError:
            pass  # pipeline not loaded — best-effort resend only

    logger.info(
        f"Customer resumed OTP verification for TX {body.transaction_id} — new {OTP_TTL_SECONDS}s window.",
        extra={
            "event_type": "CUSTOMER_OTP_RESUMED",
            "customer_id": customer_id,
            "transaction_id": body.transaction_id,
            "status": "PENDING_OTP",
        },
    )

    return {
        "transaction_id": body.transaction_id,
        "status": "PENDING_OTP",
        "fraud_probability": float(tx["fraud_probability"] or 0.0),
        "scenario": tx["scenario_name"],
        "otp_expires_in": OTP_TTL_SECONDS,
        "message": "A new verification code was sent to your WhatsApp.",
    }

_otp_sweeper_task: asyncio.Task | None = None


async def _expire_stale_pending_otps() -> None:
    """
    The 40s OTP window is primarily enforced by the frontend countdown
    (which calls /decline at zero), but that call can simply never
    arrive. This sweep independently declines any PENDING_OTP row whose
    otp_expires_at has already passed — same effect as /decline (status
    -> DECLINED, is_fraud -> TRUE, OTP_NOT_ENTERED), same log entry, same
    WS broadcast, so the dashboard/Logs tab can't tell the difference.
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            UPDATE transactions
            SET status = 'DECLINED', is_fraud = TRUE, top_reason = 'OTP_NOT_ENTERED'
            WHERE status = 'PENDING_OTP' AND otp_expires_at IS NOT NULL AND otp_expires_at < NOW()
            RETURNING transaction_id, customer_id, shap_explanation
            """
        )

    for row in rows:
        existing_reasons = _parse_shap_reasons(row["shap_explanation"])
        updated_reasons = [{"feature": "OTP_NOT_ENTERED", "shap_value": None, "type": "otp"}] + existing_reasons

        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE transactions SET shap_explanation = $2 WHERE transaction_id = $1",
                row["transaction_id"], json.dumps(updated_reasons),
            )

        r = get_redis()
        await r.delete(f"otp:{row['transaction_id']}")

        logger.warning(
            f"[bold red][ALERT] OTP TIMEOUT — FRAUD CONFIRMED (server sweep)[/bold red] | TX: {row['transaction_id']}",
            extra={"event_type": "OTP_TIMEOUT", "customer_id": row["customer_id"],
                   "transaction_id": row["transaction_id"], "status": "DECLINED"},
        )
        await ws_manager.broadcast({
            "event": "OTP_RESULT", "transaction_id": row["transaction_id"],
            "customer_id": row["customer_id"], "status": "DECLINED", "is_fraud": True,
            "reason": "OTP_TIMEOUT", "top_reason": "OTP_NOT_ENTERED",
            "top_reasons": updated_reasons, "timestamp": datetime.now(timezone.utc).isoformat(),
        })


async def _otp_expiry_sweep_loop(interval_seconds: int = 5) -> None:
    while True:
        try:
            await _expire_stale_pending_otps()
        except Exception:
            logger.exception("OTP expiry sweep failed — retrying next tick.")
        await asyncio.sleep(interval_seconds)


def start_otp_expiry_sweeper() -> None:
    global _otp_sweeper_task
    if _otp_sweeper_task is None:
        _otp_sweeper_task = asyncio.create_task(_otp_expiry_sweep_loop())


def stop_otp_expiry_sweeper() -> None:
    global _otp_sweeper_task
    if _otp_sweeper_task is not None:
        _otp_sweeper_task.cancel()
        _otp_sweeper_task = None


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
            "SELECT customer_id, status, shap_explanation, scenario_id, terminal_id, tx_datetime FROM transactions WHERE transaction_id = $1",
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

    # Update CSV label
    update_transaction_label(body.transaction_id, is_fraud=True, scenario_id=tx["scenario_id"])

    # If declined and scenario is 2 (Terminal Skimming), blacklist and retro-propagate
    if tx["scenario_id"] == 2:
        try:
            pipeline = get_pipeline()
            pipeline.compromise_terminal(tx["terminal_id"])
            compromise_start = tx["tx_datetime"].strftime("%Y-%m-%d %H:%M:%S")
            retro_propagate_skimming(tx["terminal_id"], compromise_start)
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE transactions
                    SET is_fraud = TRUE, scenario_id = 2, scenario_name = 'Terminal Skimming'
                    WHERE terminal_id = $1 AND tx_datetime >= $2
                    """,
                    tx["terminal_id"], tx["tx_datetime"]
                )
        except Exception as e:
            logger.error(f"Failed to compromise terminal and retro-propagate on decline: {e}")

    # Delete any leftover OTP from Redis
    r = get_redis()
    await r.delete(f"otp:{body.transaction_id}")

    logger.warning(
        f"[bold red][ALERT] OTP TIMEOUT — FRAUD CONFIRMED[/bold red] | TX: {body.transaction_id} | "
        f"Customer did not enter the OTP within the {OTP_TTL_SECONDS}s window.",
        extra={
            "event_type": "OTP_TIMEOUT",
            "customer_id": customer_id,
            "transaction_id": body.transaction_id,
            "status": "DECLINED",
        },
    )

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


class ReportFraudRequest(BaseModel):
    transaction_id: str


@router.post("/report-fraud")
async def report_fraud(
    body: ReportFraudRequest,
    customer_id: int = Depends(get_current_customer),
):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        tx = await conn.fetchrow(
            "SELECT customer_id, terminal_id, tx_amount, tx_datetime, status FROM transactions WHERE transaction_id = $1",
            body.transaction_id,
        )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    if tx["customer_id"] != customer_id:
        raise HTTPException(status_code=403, detail="Not your transaction.")

    # Update status to 'REPORTED_FRAUD', is_fraud = True
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE transactions
            SET status = 'REPORTED_FRAUD', is_fraud = TRUE, scenario_id = 2, scenario_name = 'Terminal Skimming'
            WHERE transaction_id = $1
            """,
            body.transaction_id,
        )

    # Update CSV label
    update_transaction_label(body.transaction_id, is_fraud=True, scenario_id=2)

    # Blacklist the terminal in the pipeline
    try:
        pipeline = get_pipeline()
        pipeline.compromise_terminal(tx["terminal_id"])

        # Retroactively update labels of all transactions at this terminal during the compromise window!
        compromise_start = tx["tx_datetime"].strftime("%Y-%m-%d %H:%M:%S")
        retro_propagate_skimming(tx["terminal_id"], compromise_start)

        # Update PostgreSQL database labels too!
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE transactions
                SET is_fraud = TRUE, scenario_id = 2, scenario_name = 'Terminal Skimming'
                WHERE terminal_id = $1 AND tx_datetime >= $2
                """,
                tx["terminal_id"], tx["tx_datetime"]
            )
    except Exception as e:
        logger.error(f"Failed to compromise terminal and retro-propagate on report: {e}")

    # Broadcast to dashboard
    await ws_manager.broadcast({
        "event": "TRANSACTION_REPORTED",
        "transaction_id": body.transaction_id,
        "terminal_id": tx["terminal_id"],
        "status": "REPORTED_FRAUD",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    logger.warning(
        f"[bold red][FEEDBACK] Customer {customer_id} reported Transaction {body.transaction_id} at Terminal {tx['terminal_id']} as compromised! Blacklisting terminal.",
        extra={
            "event_type": "CUSTOMER_REPORT",
            "customer_id": customer_id,
            "transaction_id": body.transaction_id,
            "terminal_id": tx["terminal_id"]
        }
    )

    return {"status": "REPORTED_FRAUD", "message": "Thank you. The transaction has been reported and security measures have been applied."}


@router.post("/simulate")
async def simulate_transaction(body: SimulateTxRequest):
    pool = await get_db_pool()
    tx_id = str(body.transaction_id)
    customer_id = body.customer_id

    # 1. Fetch customer details or seed mock customer
    async with pool.acquire() as conn:
        customer = await conn.fetchrow(
            "SELECT phone_number, registration_lat, registration_lon FROM customers WHERE customer_id = $1",
            customer_id,
        )
    if not customer:
        pw_hash = "mock_hash"
        phone = f"+2010{customer_id:08d}"
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO customers (customer_id, phone_number, password_hash, full_name, role)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (customer_id) DO NOTHING
                """,
                customer_id, phone, pw_hash, f"Customer {customer_id}", "user"
            )
        phone_number = phone
    else:
        phone_number = customer["phone_number"]

    # 2. Score transaction
    tx_dict = {
        "TRANSACTION_ID": tx_id,
        "CUSTOMER_ID":    customer_id,
        "TERMINAL_ID":    body.terminal_id,
        "TX_DATETIME":    body.tx_datetime,
        "TX_AMOUNT":      body.tx_amount,
        "PHONE_NUMBER":   phone_number,
    }

    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, score_transaction, tx_dict)

    result = {
        **result,
        "is_fraud": bool(result["is_fraud"]),
        "fraud_probability": float(result["fraud_probability"]),
        "scenario_id": int(result["scenario_id"]) if result["scenario_id"] is not None else None,
    }

    # 3. Look up ground truth
    gt_fraud, gt_scenario = lookup_ground_truth(customer_id, body.terminal_id, body.tx_amount)

    initial_status = "PENDING_OTP" if result["is_fraud"] else "APPROVED"
    final_is_fraud = result["is_fraud"]
    final_scenario_id = result["scenario_id"]
    final_scenario_name = result["scenario_name"]

    # If it is a False Negative, trigger automated customer feedback loop
    if not result["is_fraud"] and gt_fraud == 1:
        initial_status = "REPORTED_FRAUD"
        final_is_fraud = True
        final_scenario_id = gt_scenario if gt_scenario > 0 else 2
        final_scenario_name = {1: "Large Amount", 2: "Terminal Skimming", 3: "Credential Takeover"}.get(final_scenario_id, "Terminal Skimming")

        logger.warning(
            f"[bold yellow][FEEDBACK] Customer {customer_id} noticed unauthorized activity from Terminal {body.terminal_id} and filed a report.[/bold yellow]",
            extra={
                "event_type": "CUSTOMER_FEEDBACK",
                "customer_id": customer_id,
                "terminal_id": body.terminal_id,
                "transaction_id": tx_id
            }
        )

        if final_scenario_id == 2:
            try:
                pipeline = get_pipeline()
                pipeline.compromise_terminal(body.terminal_id)
                retro_propagate_skimming(body.terminal_id, body.tx_datetime)
                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        UPDATE transactions
                        SET is_fraud = TRUE, scenario_id = 2, scenario_name = 'Terminal Skimming'
                        WHERE terminal_id = $1 AND tx_datetime >= $2
                        """,
                        body.terminal_id, body.tx_datetime
                    )
            except Exception as e:
                logger.error(f"Failed to compromise terminal and retro-propagate: {e}")

    otp_expires_at = None
    if result["is_fraud"]:
        # Standard OTP expires at now + 40s
        otp_expires_at = datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS)

    # 4. Insert into database
    # Since we can have SQLite or Postgres, we parse dates
    from backend.db.postgres import _use_sqlite
    now_parsed = datetime.fromisoformat(body.tx_datetime.replace(" ", "T")) if "T" not in body.tx_datetime else datetime.fromisoformat(body.tx_datetime)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO transactions (
                transaction_id, customer_id, terminal_id, tx_amount, tx_datetime,
                is_fraud, fraud_probability, scenario_id, scenario_name,
                top_reason, status, shap_explanation, otp_expires_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (transaction_id) DO NOTHING
            """,
            tx_id, customer_id, body.terminal_id, body.tx_amount, now_parsed,
            final_is_fraud, result["fraud_probability"],
            final_scenario_id, final_scenario_name,
            result["top_reason"], initial_status,
            json.dumps(result.get("top_reasons", [])),
            otp_expires_at,
        )

    # 5. Save to CSV
    append_transaction(
        tx_dict,
        is_fraud=final_is_fraud,
        scenario_id=final_scenario_id
    )

    # 6. Broadcast to WebSocket
    await ws_manager.broadcast({
        "event":              "TRANSACTION",
        "transaction_id":     tx_id,
        "customer_id":        customer_id,
        "terminal_id":        body.terminal_id,
        "amount":             body.tx_amount,
        "fraud_probability":  result["fraud_probability"],
        "is_fraud":           final_is_fraud,
        "scenario_name":      final_scenario_name,
        "top_reason":         result["top_reason"],
        "top_reasons":        result.get("top_reasons", []),
        "status":             initial_status,
        "timestamp":          now_parsed.isoformat(),
    })

    if result["is_fraud"]:
        otp = generate_otp()
        await store_otp(tx_id, otp, ttl=OTP_TTL_SECONDS)

    return {"status": initial_status, "transaction_id": tx_id}