"""
batch_predictor.py
===================
Orchestrates the full offline/batch path:

    raw input (dict / list / DataFrame / CSV / Excel)
        -> TransactionInputLoader   (read + validate)
        -> FraudFeatureEngineer     (engineer the same features used in training)
        -> FraudModelBundle         (fraud probability + scenario prediction)
        -> FraudModelExplainer      (per-transaction SHAP attributions)
        -> results table (+ optional CSV/Excel export)

Single responsibility: wiring the other four modules together into one
convenient call. This class doesn't know how to read files (`input_handler.py`),
compute features (`feature_engineering.py`), run models (`models.py`), or
compute SHAP/importance/PDP-ICE (`explainability.py`) — it only coordinates
them, which keeps each piece independently testable and reusable (e.g.
`fraud_pipeline.py` reuses the same `FraudFeatureEngineer`, `FraudModelBundle`,
and `FraudModelExplainer` for single-transaction, real-time scoring).

By default, every scored transaction comes back with its fraud/scenario
prediction AND a `shap_fraud_<feature>` column per engineered feature —
the per-transaction contribution of that feature to the fraud probability.
These are plain numeric columns, so they drop straight into a dataframe,
a plotting library, or a report without any extra wiring.

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

    # 4) an Excel file, saving the scored + explained output back out
    results = predictor.predict_and_save("new_transactions.xlsx", "scored.xlsx")

    # global reporting, independent of any single prediction call
    predictor.get_feature_importance()                                   # gain-based ranking
    predictor.compute_partial_dependence("TX_AMOUNT")                    # PDP + ICE curves
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd

from feature_engineering import FEATURE_COLS, FraudFeatureEngineer
from input_handler import InputSource, TransactionInputLoader
from models import FraudModelBundle
from explainability import FraudModelExplainer

logger = logging.getLogger("batch_predictor")

OUTPUT_COLUMNS = [
    "TRANSACTION_ID", "fraud_probability", "is_fraud",
    "scenario_id", "scenario_name", "scenario_confidence", "is_cold_start",
]


class FraudBatchPredictor:
    """Scores a batch of new transactions coming from a dict, list, DataFrame,
    CSV, or Excel file, and (by default) attaches per-transaction SHAP
    explanations to the results."""

    def __init__(
        self,
        feature_engineer: FraudFeatureEngineer,
        model_bundle: FraudModelBundle,
        explainer: Optional[FraudModelExplainer] = None,
    ):
        self.feature_engineer = feature_engineer
        self.model_bundle = model_bundle
        self.explainer = explainer
        self._last_scored_features: Optional[pd.DataFrame] = None

    # ------------------------------------------------------------------ #
    @classmethod
    def from_artifacts(
        cls, artifacts_dir: str | Path = "models", *, load_explainer: bool = True
    ) -> "FraudBatchPredictor":
        """Load the fitted feature engineer + both trained models from disk,
        and (by default) build a `FraudModelExplainer` on top of them so
        every prediction can be explained without any extra setup."""
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
    def predict(
        self, source: InputSource, *, update_state: bool = True, include_explanations: bool = True,
        raise_on_error: bool = False,
    ) -> pd.DataFrame:
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
        include_explanations : if True (default), attaches one
            `shap_fraud_<feature>` column per engineered feature (that
            feature's contribution to the fraud probability) for every row,
            AND one `shap_scenario_<feature>` column per feature (that
            feature's contribution to the predicted scenario) for rows
            flagged as fraud — mirroring `scenario_id` / `scenario_name` /
            `scenario_confidence`, which are only populated when `is_fraud`
            is True. Rows that weren't flagged as fraud get zero-filled
            `shap_scenario_*` columns, since there's no predicted scenario to
            explain. Requires the explainer to have loaded successfully
            (needs the `shap` package installed).
        raise_on_error : if False (default, production-safe), a transaction
            that fails to score (e.g. an unknown CUSTOMER_ID/TERMINAL_ID, or
            any other unexpected error) is logged and recorded in the
            `scoring_error` column instead of raising — the rest of the
            batch still gets scored normally. Set True to fail fast instead
            (e.g. in tests, or a CLI run where you want to catch data issues
            immediately).

        Returns
        -------
        A DataFrame with one row per input transaction:
        TRANSACTION_ID, CUSTOMER_ID, TERMINAL_ID, TX_DATETIME, TX_AMOUNT,
        fraud_probability, is_fraud, scenario_id, scenario_name,
        scenario_confidence, scoring_error (None unless that row failed),
        and (if requested) the SHAP explanation columns for every row that
        scored successfully.
        """
        raw_df = TransactionInputLoader.load(source)
        validated_df = TransactionInputLoader.validate(raw_df)
        records = TransactionInputLoader.to_records(validated_df)

        prediction_rows = []
        feature_rows = []
        scored_tx_ids = []
        errors = {}

        for tx in records:
            tx_id = tx.get("TRANSACTION_ID")
            try:
                features = self.feature_engineer.transform(tx)
                prediction = self.model_bundle.predict_one(features, transaction_id=tx_id)
                # Checked before register_realtime_state, which may promote
                # this customer out of cold start as a side effect.
                prediction.is_cold_start = self.feature_engineer.is_cold_start(tx["CUSTOMER_ID"])
                if update_state:
                    self.feature_engineer.register_realtime_state(tx)
                prediction_rows.append(prediction.to_dict())
                feature_rows.append(features)
                scored_tx_ids.append(tx_id)
            except Exception as exc:
                if raise_on_error:
                    raise
                logger.error(
                    "Failed to score TRANSACTION_ID=%s: %s — skipping this row, "
                    "continuing with the rest of the batch.", tx_id, exc,
                )
                errors[tx_id] = str(exc)
                prediction_rows.append({
                    "TRANSACTION_ID": tx_id,
                    "fraud_probability": None, "is_fraud": None,
                    "scenario_id": None, "scenario_name": None, "scenario_confidence": None,
                    "is_cold_start": None,
                })

        predictions_df = pd.DataFrame(prediction_rows, columns=OUTPUT_COLUMNS)
        merged = validated_df.merge(predictions_df, on="TRANSACTION_ID", how="left")
        merged["scoring_error"] = merged["TRANSACTION_ID"].map(errors) if errors else None

        self._last_scored_features = pd.concat(feature_rows, ignore_index=True) if feature_rows else None

        if include_explanations:
            if not feature_rows:
                logger.warning(
                    "include_explanations=True but every row in this batch failed to "
                    "score — nothing to explain, skipping SHAP columns."
                )
            else:
                if self.explainer is None:
                    raise RuntimeError(
                        "Explanations were requested but no explainer is loaded. "
                        "Install the 'shap' package and reload with "
                        "FraudBatchPredictor.from_artifacts(..., load_explainer=True), "
                        "or call predict(..., include_explanations=False)."
                    )
                scenario_by_tx_id = {r["TRANSACTION_ID"]: r["scenario_id"] for r in prediction_rows}
                scenario_ids_for_shap = [scenario_by_tx_id[tid] for tid in scored_tx_ids]
                shap_df = self.explainer.explain_batch_full(
                    self._last_scored_features, scenario_ids=scenario_ids_for_shap
                )
                shap_df["TRANSACTION_ID"] = scored_tx_ids
                merged = merged.merge(shap_df, on="TRANSACTION_ID", how="left")

        n_scored = len(scored_tx_ids)
        n_failed = len(errors)
        n_flagged = int(merged["is_fraud"].fillna(False).astype(bool).sum())
        logger.info(
            "Scored %d/%d transaction(s) — %d flagged as fraud, %d failed to score.",
            n_scored, len(merged), n_flagged, n_failed,
        )
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
    # Global explainability reporting (independent of any single predict() call)
    # ------------------------------------------------------------------ #
    def get_feature_importance(self, model: str = "fraud", importance_type: str = "gain") -> pd.DataFrame:
        """Global feature importance for the fraud or scenario model.
        model: "fraud" or "scenario". importance_type: "gain" or "split"."""
        if self.explainer is None:
            raise RuntimeError("No explainer loaded — see FraudBatchPredictor.from_artifacts.")
        return self.explainer.global_feature_importance(model=model, importance_type=importance_type)

    def compute_partial_dependence(
        self, feature: str, *, model: str = "fraud", kind: str = "both",
        grid_resolution: int = 50, reference_data: Optional[pd.DataFrame] = None,
    ) -> dict:
        """PDP + ICE curves for `feature`. If `reference_data` isn't supplied,
        uses the engineered features from the most recent `predict()` call —
        so run a representative batch through `predict()` first, or pass your
        own reference sample (e.g. from `build_training_frames`)."""
        if self.explainer is None:
            raise RuntimeError("No explainer loaded — see FraudBatchPredictor.from_artifacts.")
        reference_data = reference_data if reference_data is not None else self._last_scored_features
        if reference_data is None:
            raise RuntimeError(
                "No reference data available. Either call predict() first, "
                "or pass reference_data=... explicitly."
            )
        return self.explainer.partial_dependence(
            feature, reference_data, model=model, kind=kind, grid_resolution=grid_resolution
        )

    # ------------------------------------------------------------------ #
    # Warm start — see FraudFeatureEngineer for the full docstrings.
    # ------------------------------------------------------------------ #
    def warm_start_from_history(self, history_df: pd.DataFrame, **kwargs) -> dict:
        """Seed every returning customer's realtime lag/velocity state from a
        slice of real transaction history (e.g. the last few hours/days from
        your transactions table) before scoring a batch — so customers who
        already exist in the database use their real history instead of
        cold-starting. Call this once, e.g. right after `from_artifacts()`."""
        return self.feature_engineer.warm_start_from_history(history_df, **kwargs)

    def warm_start_customer(self, customer_id, history_df: pd.DataFrame) -> bool:
        """Seed a single known customer's realtime state from their real
        transaction history. See `FraudFeatureEngineer.warm_start_customer`."""
        return self.feature_engineer.warm_start_customer(customer_id, history_df)

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
    parser.add_argument("--no-explanations", action="store_true",
                         help="Skip attaching per-transaction SHAP explanation columns.")
    args = parser.parse_args()

    input_path = Path(args.input)
    source: InputSource = (
        json.loads(input_path.read_text()) if input_path.suffix.lower() == ".json" else input_path
    )

    predictor = FraudBatchPredictor.from_artifacts(args.artifacts_dir)
    update_state = not args.no_update_state
    include_explanations = not args.no_explanations

    if args.output:
        results_df = predictor.predict_and_save(
            source, args.output, update_state=update_state, include_explanations=include_explanations
        )
    else:
        results_df = predictor.predict(
            source, update_state=update_state, include_explanations=include_explanations
        )
        pd.set_option("display.max_columns", None)
        pd.set_option("display.width", 160)
        print(results_df.to_string(index=False))

    if update_state:
        predictor.save_state(args.artifacts_dir)