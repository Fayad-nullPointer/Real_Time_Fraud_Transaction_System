"""
core/pipeline_wrapper.py
========================
Loads the FraudDetectionPipeline once at server startup and exposes
a clean async-friendly interface for the transaction router.

Call `load_pipeline()` from the FastAPI lifespan, then
call `score_transaction(...)` from the transaction endpoint.
"""
from __future__ import annotations

import sys
import time
import random
import string
from pathlib import Path
from typing import Optional
import pandas as pd
from backend.db.postgres import get_db_pool

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from scripts.fraud_pipeline import FraudDetectionPipeline

_pipeline: Optional[FraudDetectionPipeline] = None
_load_time_ms: float = 0.0
_inference_time_ms: float = 0.0
_fraud_dict: dict = {}

def load_pipeline() -> None:
    global _pipeline, _load_time_ms, _fraud_dict
    t0 = time.perf_counter()
    models_dir = ROOT / "models"
    _pipeline = FraudDetectionPipeline.from_artifacts(
        models_dir,
        load_explainer=True,
        send_whatsapp_alerts=True,
    )
    _load_time_ms = (time.perf_counter() - t0) * 1000
    print(f"[pipeline] Loaded in {_load_time_ms:.1f} ms")

    # Load fraud dictionary for ground truth matching
    csv_path = ROOT / "data" / "synthetic_fraud_transactions.csv"
    if not csv_path.exists():
        csv_path = ROOT.parent / "data" / "synthetic_fraud_transactions.csv"
    if csv_path.exists():
        print("[pipeline] Loading fraud cases for ground truth matching...")
        try:
            df = pd.read_csv(csv_path)
            fraud_df = df[df["TX_FRAUD"] == 1]
            for _, row in fraud_df.iterrows():
                key = (int(row["CUSTOMER_ID"]), int(row["TERMINAL_ID"]), round(float(row["TX_AMOUNT"]), 2))
                _fraud_dict[key] = int(row.get("TX_FRAUD_SCENARIO", 0))
            print(f"[pipeline] Loaded {len(_fraud_dict)} fraud cases into memory.")
        except Exception as e:
            print(f"[pipeline] Warning: Failed to load fraud cases from CSV: {e}")


def lookup_ground_truth(customer_id: int, terminal_id: int, amount: float) -> tuple[int, int]:
    key = (int(customer_id), int(terminal_id), round(float(amount), 2))
    scenario_id = _fraud_dict.get(key)
    if scenario_id is not None:
        return 1, scenario_id
    return 0, 0


async def warm_start_pipeline(hours: int = 48) -> dict:
    """
    Seed every returning customer's realtime lag/velocity buffers from
    recent Postgres history right after the pipeline loads, so a fresh
    deploy/restart doesn't score long-time customers as if they had no
    history. Call once from the FastAPI lifespan, after load_pipeline().
    """
    pipeline = get_pipeline()
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT customer_id AS "CUSTOMER_ID", terminal_id AS "TERMINAL_ID",
                   tx_datetime AS "TX_DATETIME", tx_amount AS "TX_AMOUNT"
            FROM transactions
            WHERE tx_datetime >= NOW() - ($1 || ' hours')::interval
            ORDER BY customer_id, tx_datetime
            """,
            str(hours),
        )
    if not rows:
        print("[pipeline] No recent history found — nothing to warm start.")
        return {"customers_warmed": 0, "customers_skipped": 0}

    history_df = pd.DataFrame([dict(r) for r in rows])
    stats = pipeline.warm_start_from_history(history_df)
    print(f"[pipeline] Warm start complete: {stats}")
    return stats

def get_pipeline() -> FraudDetectionPipeline:
    if _pipeline is None:
        raise RuntimeError("Pipeline not loaded. Call load_pipeline() first.")
    return _pipeline


async def ensure_customer_warmed(customer_id: int) -> bool:
    """If this customer's in-memory pipeline state is not warm yet, fetch their
    transaction history from PostgreSQL and warm start them lazily."""
    pipeline = get_pipeline()
    if pipeline.is_warm(customer_id):
        return True

    pool = await get_db_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT customer_id AS "CUSTOMER_ID", terminal_id AS "TERMINAL_ID",
                   tx_datetime AS "TX_DATETIME", tx_amount AS "TX_AMOUNT"
            FROM transactions
            WHERE customer_id = $1
            ORDER BY tx_datetime ASC
            """,
            customer_id,
        )
    if rows:
        df = pd.DataFrame([dict(r) for r in rows])
        pipeline.warm_start_customer(customer_id, df)
        return True
    return False


def get_inference_time_ms() -> float:
    return _inference_time_ms


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _rank_top_reasons(explanation: dict | None, top_n: int = 6) -> list[dict]:
    """
    Turn the raw `shap_fraud_<feature>` / `shap_scenario_<feature>` dict
    from FraudModelExplainer.explain_transaction into a small, ranked,
    UI-ready list:

        [{"feature": "TX_AMOUNT", "shap_value": 0.42, "type": "fraud"}, ...]

    Ranked by absolute SHAP value across BOTH the fraud and scenario
    explanations together, since for a flagged transaction both are
    relevant ("why fraud" and "why this scenario"). This is what gets
    persisted to transactions.shap_explanation and returned to the
    dashboard for the per-transaction detail view.
    """
    if not explanation:
        return []

    seen_features = set()
    out = []
    ranked = sorted(explanation.items(), key=lambda kv: abs(kv[1]), reverse=True)
    for key, value in ranked:
        if key.startswith("shap_scenario_"):
            feature, kind = key[len("shap_scenario_"):], "scenario"
        elif key.startswith("shap_fraud_"):
            feature, kind = key[len("shap_fraud_"):], "fraud"
        else:
            feature, kind = key, "fraud"

        if feature in seen_features:
            continue
        seen_features.add(feature)

        val_float = round(float(value), 6)
        out.append({
            "feature": feature,
            "shap_value": val_float,
            "impact": val_float,
            "type": kind
        })
        if len(out) >= top_n:
            break
    return out


def score_transaction(tx_dict: dict) -> dict:
    """
    Runs the ML pipeline on tx_dict and returns a result dict.
    tx_dict must contain: TRANSACTION_ID, CUSTOMER_ID, TERMINAL_ID,
                          TX_DATETIME (str), TX_AMOUNT, PHONE_NUMBER
    Returns:
    {
        "is_fraud": bool,
        "fraud_probability": float,
        "scenario_id": int | None,
        "scenario_name": str | None,
        "top_reason": str | None,          # single highest-|SHAP| feature name
        "top_reasons": list[dict],         # ranked, UI-ready — see _rank_top_reasons
        "explanation": dict | None,        # raw shap_fraud_*/shap_scenario_* dict
    }
    """
    global _inference_time_ms
    pipeline = get_pipeline()
    t0 = time.perf_counter()
    prediction, explanation = pipeline.process_transaction(
        tx_dict, update_state=True, explain=True
    )
    _inference_time_ms = (time.perf_counter() - t0) * 1000

    # Pick the top SHAP reason
    top_reason: str | None = None
    if explanation:
        top_reason = max(explanation, key=lambda k: abs(explanation[k]), default=None)

    return {
        "is_fraud":         prediction.is_fraud,
        "fraud_probability": float(prediction.fraud_probability),
        "scenario_id":      prediction.scenario_id,
        "scenario_name":    prediction.scenario_name,
        "top_reason":       top_reason,
        "top_reasons":      _rank_top_reasons(explanation),
        "explanation":      explanation,
    }

def get_customer_state(customer_id) -> dict:
    return get_pipeline().get_customer_debug_state(customer_id)