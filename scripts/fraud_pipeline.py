"""
fraud_pipeline.py
==================
Production inference pipeline: new transaction in -> engineered features ->
fraud probability + (if flagged) fraud-scenario prediction out.

This is the single entry point you wire into a FastAPI endpoint, a Kafka
consumer, a batch job, etc. It hides the two-stage machinery (feature
engineering, then the two models) behind one small class.

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

Batch scoring of a historical/offline DataFrame (already containing engineered
features, e.g. from `train_and_save_models.py`'s `build_training_frames`)
should instead call `FraudModelBundle.predict_batch` directly — see
`models.py`. This script is optimized for one-transaction-at-a-time,
stateful, real-time scoring.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterable, List

from feature_engineering import FraudFeatureEngineer
from models import FraudModelBundle, FraudPrediction

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("fraud_pipeline")


class FraudDetectionPipeline:
    """
    End-to-end, stateful fraud-detection pipeline.

    Composition, not inheritance: this class owns a `FraudFeatureEngineer`
    (feature computation + realtime customer state) and a `FraudModelBundle`
    (the two trained models), and just orchestrates the two.
    """

    def __init__(self, feature_engineer: FraudFeatureEngineer, model_bundle: FraudModelBundle):
        self.feature_engineer = feature_engineer
        self.model_bundle = model_bundle

    # ------------------------------------------------------------------ #
    @classmethod
    def from_artifacts(cls, artifacts_dir: str | Path = "models") -> "FraudDetectionPipeline":
        """Load the fitted feature engineer + both trained models from disk."""
        artifacts_dir = Path(artifacts_dir)
        fe = FraudFeatureEngineer.load(artifacts_dir / "feature_engineer.pkl")
        bundle = FraudModelBundle.load(artifacts_dir)
        logger.info("Loaded feature engineer and model bundle from %s", artifacts_dir)
        return cls(fe, bundle)

    # ------------------------------------------------------------------ #
    def process_transaction(self, tx: dict, *, update_state: bool = True) -> FraudPrediction:
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
        return prediction

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
    args = parser.parse_args()

    tx = json.loads(args.transaction_json)
    pipeline = FraudDetectionPipeline.from_artifacts(args.artifacts_dir)
    result = pipeline.process_transaction(tx)
    print(json.dumps(result.to_dict(), indent=2))
