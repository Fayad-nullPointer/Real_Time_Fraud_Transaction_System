"""
models.py
=========
Thin OOP wrapper around the two trained artifacts:

1. FraudDetector   — binary classifier, P(TX_FRAUD = 1).
                      Best model per `04-engineered_features_model.ipynb` /
                      `fraud_modelling_optimized.ipynb`: a LightGBM
                      classifier inside a sklearn Pipeline
                      (StandardScaler + OneHotEncoder -> LGBMClassifier),
                      with a decision threshold tuned on the holdout split
                      (F1-optimal, exactly as in the notebooks).

2. ScenarioDetector — multiclass classifier over TX_FRAUD_SCENARIO
                      (1 = Large Amount, 2 = Skimming, 3 = Credential
                      Takeover), trained only on rows flagged as fraud.
                      This is the "which attack pattern is this" model
                      referenced alongside the fraud/no-fraud model.

Both are persisted with joblib and reloaded through `FraudModelBundle.load`.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings(
    "ignore",
    message="X does not have valid feature names",
    category=UserWarning,
)

from feature_engineering import FEATURE_COLS

SCENARIO_NAMES = {
    0: "Not Fraud",
    1: "Large Amount",
    2: "Terminal Skimming",
    3: "Credential Takeover",
}


@dataclass
class FraudPrediction:
    transaction_id: object
    fraud_probability: float
    is_fraud: bool
    scenario_id: Optional[int]
    scenario_name: Optional[str]
    scenario_confidence: Optional[float]

    def to_dict(self) -> dict:
        return {
            "TRANSACTION_ID": self.transaction_id,
            "fraud_probability": round(float(self.fraud_probability), 6),
            "is_fraud": bool(self.is_fraud),
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "scenario_confidence": (
                round(float(self.scenario_confidence), 6)
                if self.scenario_confidence is not None else None
            ),
        }


class FraudModelBundle:
    """Loads and serves the two trained models behind one simple API."""

    FRAUD_MODEL_FILE = "fraud_detector.joblib"
    SCENARIO_MODEL_FILE = "scenario_detector.joblib"
    THRESHOLD_FILE = "fraud_threshold.joblib"

    def __init__(self, fraud_model, scenario_model, fraud_threshold: float):
        self.fraud_model = fraud_model
        self.scenario_model = scenario_model
        self.fraud_threshold = fraud_threshold

    # ------------------------------------------------------------------ #
    def _require_columns(self, X: pd.DataFrame) -> None:
        """Fail fast with a precise message if the engineered features don't
        have what the models expect — much easier to debug in production
        than a cryptic sklearn/LightGBM shape error three layers down."""
        missing = [c for c in FEATURE_COLS if c not in X.columns]
        if missing:
            raise ValueError(
                f"Engineered features are missing required column(s): {missing}. "
                f"This usually means FraudFeatureEngineer / FEATURE_COLS is out of "
                f"sync with the trained model artifacts."
            )

    def _scenario_prediction(self, X: pd.DataFrame, is_fraud: np.ndarray):
        """Run the scenario model (when one is loaded) ONLY on rows flagged
        as fraud by the fraud detector, and return the single best-guess
        (scenario_id, scenario_name, scenario_confidence) per row — `None`
        for every row where `is_fraud` is False.

        IMPORTANT — how to read this: the scenario model was trained only on
        confirmed-fraud rows, so it's only meaningful to ask "which attack
        pattern does this look like" once a transaction has already been
        flagged as fraud by the fraud detector (the authoritative signal for
        whether to act on a transaction). Non-fraud rows get `None`s instead
        of a scenario guess, since "which fraud scenario would this be if it
        weren't fraud" isn't a well-posed question.
        """
        n = len(X)
        scenario_id = [None] * n
        scenario_name = [None] * n
        scenario_conf = [None] * n

        if self.scenario_model is None:
            return scenario_id, scenario_name, scenario_conf

        is_fraud = np.asarray(is_fraud)
        fraud_positions = np.where(is_fraud)[0]
        if len(fraud_positions) == 0:
            return scenario_id, scenario_name, scenario_conf

        X_fraud = X.iloc[fraud_positions]
        proba = self.scenario_model.predict_proba(X_fraud)
        classes = self.scenario_model.classes_
        best_idx = proba.argmax(axis=1)
        ids = classes[best_idx]
        confs = proba[np.arange(len(X_fraud)), best_idx]
        names = [SCENARIO_NAMES.get(int(s)) for s in ids]

        for pos, sid, sname, sconf in zip(fraud_positions, ids, names, confs):
            scenario_id[pos] = sid
            scenario_name[pos] = sname
            scenario_conf[pos] = sconf

        return scenario_id, scenario_name, scenario_conf

    def predict_one(self, features: pd.DataFrame, transaction_id=None) -> FraudPrediction:
        """`features` is the single-row DataFrame returned by
        `FraudFeatureEngineer.transform`.

        Returns fraud_probability/is_fraud from the fraud detector, AND
        scenario_id/scenario_name/scenario_confidence from the scenario
        model ONLY if `is_fraud` is True — see `_scenario_prediction` for
        why non-fraud rows get `None` scenario fields instead.
        """
        X = features[FEATURE_COLS]
        self._require_columns(X)

        fraud_prob = float(self.fraud_model.predict_proba(X)[:, 1][0])
        is_fraud = fraud_prob >= self.fraud_threshold

        scenario_ids, scenario_names, scenario_confs = self._scenario_prediction(
            X, is_fraud=np.array([is_fraud])
        )
        scenario_id, scenario_name, scenario_conf = scenario_ids[0], scenario_names[0], scenario_confs[0]

        return FraudPrediction(
            transaction_id=transaction_id,
            fraud_probability=fraud_prob,
            is_fraud=is_fraud,
            scenario_id=int(scenario_id) if scenario_id is not None else None,
            scenario_name=scenario_name,
            scenario_confidence=float(scenario_conf) if scenario_conf is not None else None,
        )

    def predict_batch(self, features_df: pd.DataFrame) -> pd.DataFrame:
        """Vectorized scoring for a DataFrame of many already-engineered rows
        (each row = FEATURE_COLS). Useful for batch/offline scoring.

        Like `predict_one`, scenario_id/scenario_name/scenario_confidence are
        populated ONLY for rows where is_fraud is True — see
        `_scenario_prediction` for why non-fraud rows get `None` instead.
        """
        X = features_df[FEATURE_COLS]
        self._require_columns(X)

        fraud_prob = self.fraud_model.predict_proba(X)[:, 1]
        is_fraud = fraud_prob >= self.fraud_threshold

        scenario_id, scenario_name, scenario_conf = self._scenario_prediction(X, is_fraud=is_fraud)

        out = features_df.copy()
        out["fraud_probability"] = fraud_prob
        out["is_fraud"] = is_fraud
        out["scenario_id"] = scenario_id
        out["scenario_name"] = scenario_name
        out["scenario_confidence"] = scenario_conf
        return out

    # ------------------------------------------------------------------ #
    def save(self, model_dir: str | Path) -> None:
        model_dir = Path(model_dir)
        model_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.fraud_model, model_dir / self.FRAUD_MODEL_FILE)
        if self.scenario_model is not None:
            joblib.dump(self.scenario_model, model_dir / self.SCENARIO_MODEL_FILE)
        joblib.dump(self.fraud_threshold, model_dir / self.THRESHOLD_FILE)

    @classmethod
    def load(cls, model_dir: str | Path) -> "FraudModelBundle":
        model_dir = Path(model_dir)
        fraud_model = joblib.load(model_dir / cls.FRAUD_MODEL_FILE)
        scenario_path = model_dir / cls.SCENARIO_MODEL_FILE
        scenario_model = joblib.load(scenario_path) if scenario_path.exists() else None
        threshold = joblib.load(model_dir / cls.THRESHOLD_FILE)
        return cls(fraud_model, scenario_model, threshold)