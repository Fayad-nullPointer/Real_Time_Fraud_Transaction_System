"""
fraud_pipeline.py
==================
Production inference pipeline: new transaction in -> engineered features ->
fraud probability + (if flagged) fraud-scenario prediction + SHAP
explanation out.

This is the single entry point you wire into a FastAPI endpoint, a Kafka
consumer, a batch job, etc. It hides the multi-stage machinery (feature
engineering, then the two models, then explainability) behind one small class.

Quick start
-----------
    from fraud_pipeline import FraudDetectionPipeline

    pipeline = FraudDetectionPipeline.from_artifacts("models")

    new_tx = {
        "TRANSACTION_ID": 123456,
        "CUSTOMER_ID": 42,
        "TERMINAL_ID": 917,
        "TX_DATETIME": "2026-07-05 02:14:00",
        "TX_AMOUNT": 189.50,
    }

    result = pipeline.process_transaction(new_tx)
    print(result.to_dict())
    # {'TRANSACTION_ID': 123456, 'fraud_probability': 0.87, 'is_fraud': True,
    #  'scenario_id': 3, 'scenario_name': 'Credential Takeover',
    #  'scenario_confidence': 0.74}

    # same call, plus a dict of per-feature SHAP contributions to the score
    result, explanation = pipeline.process_transaction(new_tx, explain=True)
    explanation["shap_fraud_TX_AMOUNT"]   # this feature's push toward/away from fraud

Batch scoring of a historical/offline DataFrame (already containing engineered
features, e.g. from `train_and_save_models.py`'s `build_training_frames`)
should instead call `FraudModelBundle.predict_batch` directly — see
`models.py`. This script is optimized for one-transaction-at-a-time,
stateful, real-time scoring. For scoring many new transactions from a
dict/list/CSV/Excel source at once (with SHAP columns attached automatically),
use `batch_predictor.FraudBatchPredictor` instead.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple, Union

from feature_engineering import FraudFeatureEngineer
from models import FraudModelBundle, FraudPrediction
from explainability import FraudModelExplainer
from feature_engineering import FEATURE_COLS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fraud_pipeline")


class FraudDetectionPipeline:
    """
    End-to-end, stateful fraud-detection pipeline.

    Composition, not inheritance: this class owns a `FraudFeatureEngineer`
    (feature computation + realtime customer state), a `FraudModelBundle`
    (the two trained models), and optionally a `FraudModelExplainer` (SHAP /
    feature importance / PDP-ICE) — and just orchestrates them.
    """

    def __init__(
        self,
        feature_engineer: FraudFeatureEngineer,
        model_bundle: FraudModelBundle,
        explainer: Optional[FraudModelExplainer] = None,
    ):
        self.feature_engineer = feature_engineer
        self.model_bundle = model_bundle
        self.explainer = explainer

    # ------------------------------------------------------------------ #
    @classmethod
    def from_artifacts(
        cls, artifacts_dir: str | Path = "models", *, load_explainer: bool = True
    ) -> "FraudDetectionPipeline":
        """Load the fitted feature engineer + both trained models from disk,
        and (by default) build a `FraudModelExplainer` on top of them."""
        artifacts_dir = Path(artifacts_dir)
        fe = FraudFeatureEngineer.load(artifacts_dir / "feature_engineer.pkl")
        bundle = FraudModelBundle.load(artifacts_dir)
        logger.info("Loaded feature engineer and model bundle from %s", artifacts_dir)

        explainer = None
        if load_explainer:
            try:
                explainer = FraudModelExplainer.from_model_bundle(bundle, FEATURE_COLS)
                logger.info("Explainability (SHAP / feature importance / PDP-ICE) ready.")
            except ImportError as exc:
                logger.warning("Explainability disabled: %s", exc)

        return cls(fe, bundle, explainer)

    # ------------------------------------------------------------------ #
    def process_transaction(
        self, tx: dict, *, update_state: bool = True, explain: bool = False
    ) -> Union[FraudPrediction, Tuple[FraudPrediction, Dict[str, float]]]:
        """
        Score a single new transaction end-to-end.

        Parameters
        ----------
        tx : dict with keys TRANSACTION_ID, CUSTOMER_ID, TERMINAL_ID,
             TX_DATETIME, TX_AMOUNT.
        update_state : if True (default), the customer's realtime lag /
             velocity buffers are updated after scoring, so the *next*
             transaction from this customer sees this one in its history.
             Set False if you're just re-scoring / simulating and don't
             want to mutate state.
        explain : if True, also returns a dict of per-feature SHAP
             contributions (`shap_fraud_<feature>`, and `shap_scenario_<feature>`
             too if the transaction was flagged as fraud). Requires the
             explainer to have loaded successfully.

        Returns
        -------
        A `FraudPrediction` normally, or `(FraudPrediction, explanation_dict)`
        if `explain=True`.
        """
        features = self.feature_engineer.transform(tx)
        prediction = self.model_bundle.predict_one(features, transaction_id=tx.get("TRANSACTION_ID"))

        if update_state:
            self.feature_engineer.register_realtime_state(tx)

        if prediction.is_fraud:
            logger.warning(
                "FRAUD FLAGGED tx=%s prob=%.3f scenario=%s (conf=%.3f)",
                prediction.transaction_id, prediction.fraud_probability,
                prediction.scenario_name, prediction.scenario_confidence or 0.0,
            )

        if not explain:
            return prediction

        if self.explainer is None:
            raise RuntimeError(
                "explain=True was requested but no explainer is loaded. "
                "Install the 'shap' package and reload with "
                "FraudDetectionPipeline.from_artifacts(..., load_explainer=True)."
            )
        explanation = self.explainer.explain_transaction(
            features, is_fraud=prediction.is_fraud, scenario_id=prediction.scenario_id
        )
        return prediction, explanation

    def process_batch(self, transactions: Iterable[dict], *, update_state: bool = True) -> List[FraudPrediction]:
        """Score a sequence of new transactions in order. Transactions MUST be
        passed in chronological order per customer so lag/velocity features
        stay correct — exactly like the notebooks' sort-then-groupby logic."""
        return [self.process_transaction(tx, update_state=update_state) for tx in transactions]

    # ------------------------------------------------------------------ #
    def refresh_daily_risk_stats(self, newly_labeled_tx_df) -> None:
        """Call once per day (batch job) after fraud investigations for the
        previous day are confirmed, to roll terminal/neighborhood risk
        lookups forward. Never called at request-time — keeps scoring
        strictly leakage-free."""
        self.feature_engineer.refresh_daily_risk_stats(newly_labeled_tx_df)
        logger.info("Daily risk stats refreshed.")

    def get_feature_importance(self, model: str = "fraud", importance_type: str = "gain"):
        """Global feature importance for the fraud or scenario model."""
        if self.explainer is None:
            raise RuntimeError("No explainer loaded — see FraudDetectionPipeline.from_artifacts.")
        return self.explainer.global_feature_importance(model=model, importance_type=importance_type)

    def save_state(self, artifacts_dir: str | Path = "models") -> None:
        """Persist the feature engineer (including accumulated realtime
        customer state) so a restarted service resumes without losing
        lag/velocity history."""
        self.feature_engineer.save(Path(artifacts_dir) / "feature_engineer.pkl")


# ---------------------------------------------------------------------- #
# CLI smoke test
# ---------------------------------------------------------------------- #
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Score one transaction from the CLI.")
    parser.add_argument("--artifacts-dir", default="models")
    parser.add_argument("--transaction-json", required=True,
                         help='e.g. \'{"TRANSACTION_ID":1,"CUSTOMER_ID":42,'
                              '"TERMINAL_ID":917,"TX_DATETIME":"2026-07-05 02:14:00",'
                              '"TX_AMOUNT":189.5}\'')
    parser.add_argument("--explain", action="store_true",
                         help="Also print per-feature SHAP contributions.")
    args = parser.parse_args()

    tx = json.loads(args.transaction_json)
    pipeline = FraudDetectionPipeline.from_artifacts(args.artifacts_dir)

    if args.explain:
        result, explanation = pipeline.process_transaction(tx, explain=True)
        print(json.dumps({**result.to_dict(), **explanation}, indent=2))
    else:
        result = pipeline.process_transaction(tx)
        print(json.dumps(result.to_dict(), indent=2))