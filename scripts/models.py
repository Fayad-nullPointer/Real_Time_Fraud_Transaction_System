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

import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import joblib
import numpy as np
import pandas as pd
import shap

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
    top_fraud_reasons: Optional[dict] = None

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
            "top_fraud_reasons": self.top_fraud_reasons,
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
        self._explainer = None

    # ------------------------------------------------------------------ #
    def predict_one(self, features: pd.DataFrame, transaction_id=None) -> FraudPrediction:
        """`features` is the single-row DataFrame returned by
        `FraudFeatureEngineer.transform`."""
        X = features[FEATURE_COLS]
        fraud_prob = float(self.fraud_model.predict_proba(X)[:, 1][0])
        is_fraud = fraud_prob >= self.fraud_threshold

        scenario_id, scenario_conf = None, None
        top_reasons = None
        if is_fraud:
            # SHAP Explanations
            if self._explainer is None:
                clf = self.fraud_model.named_steps["clf"]
                self._explainer = shap.TreeExplainer(clf)
                
            preprocessor = self.fraud_model.named_steps["preprocess"]
            X_transformed = preprocessor.transform(X)
            
            # SHAP handles dense arrays better when predicting single rows
            if hasattr(X_transformed, "toarray"):
                X_transformed = X_transformed.toarray()
                
            shap_values = self._explainer.shap_values(X_transformed)
            # Depending on LGBM objective, shap_values might be a list
            if isinstance(shap_values, list):
                row_shap = shap_values[1][0]
            else:
                row_shap = shap_values[0]
                
            feature_names = preprocessor.get_feature_names_out()
            contributions = list(zip(feature_names, row_shap))
            contributions.sort(key=lambda x: x[1], reverse=True)
            top_reasons = {feat: round(float(val), 4) for feat, val in contributions[:3] if val > 0}

            # Scenario Prediction
            if self.scenario_model is not None:
                proba = self.scenario_model.predict_proba(X)[0]
                classes = self.scenario_model.classes_
                best_idx = int(np.argmax(proba))
                scenario_id = int(classes[best_idx])
                scenario_conf = float(proba[best_idx])

        return FraudPrediction(
            transaction_id=transaction_id,
            fraud_probability=fraud_prob,
            is_fraud=is_fraud,
            scenario_id=scenario_id,
            scenario_name=SCENARIO_NAMES.get(scenario_id) if scenario_id is not None else None,
            scenario_confidence=scenario_conf,
            top_fraud_reasons=top_reasons,
        )

    def predict_batch(self, features_df: pd.DataFrame) -> pd.DataFrame:
        """Vectorized scoring for a DataFrame of many already-engineered rows
        (each row = FEATURE_COLS). Useful for batch/offline scoring."""
        X = features_df[FEATURE_COLS]
        fraud_prob = self.fraud_model.predict_proba(X)[:, 1]
        is_fraud = fraud_prob >= self.fraud_threshold

        scenario_id = np.full(len(X), np.nan)
        scenario_conf = np.full(len(X), np.nan)
        if is_fraud.any() and self.scenario_model is not None:
            flagged_idx = np.where(is_fraud)[0]
            proba = self.scenario_model.predict_proba(X.iloc[flagged_idx])
            classes = self.scenario_model.classes_
            best_idx = proba.argmax(axis=1)
            scenario_id[flagged_idx] = classes[best_idx]
            scenario_conf[flagged_idx] = proba[np.arange(len(best_idx)), best_idx]

        out = features_df.copy()
        out["fraud_probability"] = fraud_prob
        out["is_fraud"] = is_fraud
        out["scenario_id"] = scenario_id
        out["scenario_name"] = [
            SCENARIO_NAMES.get(int(s)) if not np.isnan(s) else None for s in scenario_id
        ]
        out["scenario_confidence"] = scenario_conf
        out["top_fraud_reasons"] = None
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
