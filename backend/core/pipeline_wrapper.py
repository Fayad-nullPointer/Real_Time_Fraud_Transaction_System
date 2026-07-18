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

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from scripts.fraud_pipeline import FraudDetectionPipeline

_pipeline: Optional[FraudDetectionPipeline] = None
_load_time_ms: float = 0.0
_inference_time_ms: float = 0.0


def load_pipeline() -> None:
    global _pipeline, _load_time_ms
    t0 = time.perf_counter()
    models_dir = ROOT / "models"
    _pipeline = FraudDetectionPipeline.from_artifacts(
        models_dir,
        load_explainer=True,
        send_whatsapp_alerts=True,
    )
    _load_time_ms = (time.perf_counter() - t0) * 1000
    print(f"[pipeline] Loaded in {_load_time_ms:.1f} ms")


def get_pipeline() -> FraudDetectionPipeline:
    if _pipeline is None:
        raise RuntimeError("Pipeline not loaded. Call load_pipeline() first.")
    return _pipeline


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

    ranked = sorted(explanation.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_n]
    out = []
    for key, value in ranked:
        if key.startswith("shap_scenario_"):
            feature, kind = key[len("shap_scenario_"):], "scenario"
        elif key.startswith("shap_fraud_"):
            feature, kind = key[len("shap_fraud_"):], "fraud"
        else:
            feature, kind = key, "fraud"
        out.append({"feature": feature, "shap_value": round(float(value), 6), "type": kind})
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