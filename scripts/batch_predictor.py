"""
batch_predictor.py
===================
Orchestrates the full offline/batch path:

    raw input (list / DataFrame / CSV / Excel)
        -> TransactionInputLoader   (read + validate)
        -> FraudFeatureEngineer     (engineer the same features used in training)
        -> FraudModelBundle         (fraud probability + scenario prediction)
        -> results table (+ optional CSV/Excel export)

Single responsibility: wiring the other three modules together into one
convenient call. This class doesn't know how to read files (`input_handler.py`),
compute features (`feature_engineering.py`), or run models (`models.py`) —
it only coordinates them, which keeps each piece independently testable
and reusable (e.g. `fraud_pipeline.py` reuses the same `FraudFeatureEngineer`
and `FraudModelBundle` for single-transaction, real-time scoring).

Quick start
-----------
    from batch_predictor import FraudBatchPredictor

    predictor = FraudBatchPredictor.from_artifacts("models")

    # 1) a single transaction dict
    results = predictor.predict(
        {"CUSTOMER_ID": 42, "TERMINAL_ID": 917,
         "TX_DATETIME": "2026-07-05 02:14:00", "TX_AMOUNT": 189.50}
    )

    # 2) a plain Python list of dicts
    results = predictor.predict([
        {"CUSTOMER_ID": 42, "TERMINAL_ID": 917,
         "TX_DATETIME": "2026-07-05 02:14:00", "TX_AMOUNT": 189.50},
        {"CUSTOMER_ID": 42, "TERMINAL_ID": 12,
         "TX_DATETIME": "2026-07-05 02:20:00", "TX_AMOUNT": 5.00},
    ])

    # 3) a CSV file
    results = predictor.predict("new_transactions.csv")

    # 4) an Excel file, saving the scored output back out
    results = predictor.predict_and_save("new_transactions.xlsx", "scored.xlsx")
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from feature_engineering import FraudFeatureEngineer
from input_handler import InputSource, TransactionInputLoader
from models import FraudModelBundle


logger = logging.getLogger("batch_predictor")

OUTPUT_COLUMNS = [
    "TRANSACTION_ID", "fraud_probability", "is_fraud",
    "scenario_id", "scenario_name", "scenario_confidence",
]


class FraudBatchPredictor:
    """Scores a batch of new transactions coming from a list, DataFrame, CSV, or Excel file."""

    def __init__(self, feature_engineer: FraudFeatureEngineer, model_bundle: FraudModelBundle):
        self.feature_engineer = feature_engineer
        self.model_bundle = model_bundle

    # ------------------------------------------------------------------ #
    @classmethod
    def from_artifacts(cls, artifacts_dir: str | Path = "models") -> "FraudBatchPredictor":
        """Load the fitted feature engineer + both trained models from disk."""
        artifacts_dir = Path(artifacts_dir)
        fe = FraudFeatureEngineer.load(artifacts_dir / "feature_engineer.pkl")
        bundle = FraudModelBundle.load(artifacts_dir)
        logger.info("Loaded feature engineer and model bundle from %s", artifacts_dir)
        return cls(fe, bundle)

    # ------------------------------------------------------------------ #
    def predict(self, source: InputSource, *, update_state: bool = True) -> pd.DataFrame:
        """
        Score every transaction in `source`.

        Parameters
        ----------
        source : a single transaction dict, a list of dicts, a pandas
            DataFrame, or a path to a .csv / .xlsx / .xls file. See
            `input_handler.RAW_TX_SCHEMA` for the required columns.
        update_state : if True (default), each customer's realtime lag /
            velocity buffers are updated as transactions are scored, so
            later rows for the same customer see earlier ones in this same
            batch. Set False to score a batch without mutating pipeline state
            (e.g. re-scoring the same data for analysis).

        Returns
        -------
        A DataFrame with one row per input transaction (original columns
        preserved) plus: fraud_probability, is_fraud, scenario_id,
        scenario_name, scenario_confidence.
        """
        raw_df = TransactionInputLoader.load(source)
        validated_df = TransactionInputLoader.validate(raw_df)
        records = TransactionInputLoader.to_records(validated_df)

        rows = []
        for tx in records:
            features = self.feature_engineer.transform(tx)
            prediction = self.model_bundle.predict_one(
                features, transaction_id=tx["TRANSACTION_ID"]
            )
            if update_state:
                self.feature_engineer.register_realtime_state(tx)
            rows.append(prediction.to_dict())

        predictions_df = pd.DataFrame(rows, columns=OUTPUT_COLUMNS)
        merged = validated_df.merge(predictions_df, on="TRANSACTION_ID", how="left")

        n_flagged = int(merged["is_fraud"].sum())
        logger.info("Scored %d transaction(s) — %d flagged as fraud.", len(merged), n_flagged)
        return merged

    def predict_and_save(
        self, source: InputSource, output_path: str | Path, **predict_kwargs
    ) -> pd.DataFrame:
        """Same as `predict`, then also writes the results to `output_path`
        (.csv or .xlsx/.xls, chosen from the file extension)."""
        results_df = self.predict(source, **predict_kwargs)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        suffix = output_path.suffix.lower()
        if suffix == ".csv":
            results_df.to_csv(output_path, index=False)
        elif suffix in (".xlsx", ".xls"):
            results_df.to_excel(output_path, index=False)
        else:
            raise ValueError(f"Unsupported output extension '{suffix}'. Use .csv or .xlsx.")

        logger.info("Results saved to %s", output_path)
        return results_df

    # ------------------------------------------------------------------ #
    def save_state(self, artifacts_dir: str | Path = "models") -> None:
        """Persist the feature engineer (including realtime customer state
        accumulated by this batch) so a later run resumes without losing
        lag/velocity history."""
        self.feature_engineer.save(Path(artifacts_dir) / "feature_engineer.pkl")


# ---------------------------------------------------------------------- #
# CLI
# ---------------------------------------------------------------------- #
if __name__ == "__main__":
    import argparse
    import json

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    parser = argparse.ArgumentParser(
        description="Score a batch of new transactions for fraud + fraud scenario."
    )
    parser.add_argument("--artifacts-dir", default="models",
                         help="Directory containing feature_engineer.pkl, "
                              "fraud_detector.joblib, scenario_detector.joblib, "
                              "fraud_threshold.joblib.")
    parser.add_argument("--input", required=True,
                         help="Path to a .csv, .xlsx/.xls file, or a .json file "
                              "containing a list of transaction records.")
    parser.add_argument("--output", default=None,
                         help="Optional path (.csv or .xlsx) to save the scored results.")
    parser.add_argument("--no-update-state", action="store_true",
                         help="Don't update realtime customer lag/velocity state "
                              "after scoring (use for re-scoring / analysis only).")
    args = parser.parse_args()

    input_path = Path(args.input)
    source: InputSource = (
        json.loads(input_path.read_text()) if input_path.suffix.lower() == ".json" else input_path
    )

    predictor = FraudBatchPredictor.from_artifacts(args.artifacts_dir)
    update_state = not args.no_update_state

    if args.output:
        results_df = predictor.predict_and_save(source, args.output, update_state=update_state)
    else:
        results_df = predictor.predict(source, update_state=update_state)
        pd.set_option("display.max_columns", None)
        pd.set_option("display.width", 160)
        print(results_df.to_string(index=False))

    if update_state:
        predictor.save_state(args.artifacts_dir)
