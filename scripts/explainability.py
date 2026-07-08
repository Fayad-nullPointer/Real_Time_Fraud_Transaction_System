"""
explainability.py
==================
Model interpretability toolkit for the fraud detector and scenario detector:

  - `TreeShapExplainer`        : per-transaction SHAP (TreeSHAP) attributions
                                 — "why did THIS transaction get this score".
  - `FeatureImportanceReporter`: global gain/split feature importance
                                 — "which features matter most overall".
  - `PartialDependenceAnalyzer`: PDP + ICE curves for a feature
                                 — "how does the prediction change as ONE
                                 feature varies, holding others fixed".
  - `FraudModelExplainer`      : a facade that bundles all three for both the
                                 fraud detector and the scenario detector, so
                                 the rest of the pipeline only has to hold
                                 one object.

Single responsibility: turn a trained model + engineered features into
interpretability numbers/arrays. This module has no idea how transactions
were loaded (`input_handler.py`) or how predictions get assembled into an
output table (`batch_predictor.py` / `fraud_pipeline.py`) — it only explains
whatever model + data it's given, so it can be reused identically in a
notebook, a batch job, or a reporting script.

Requires the `shap` package: `pip install shap`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

import numpy as np
import pandas as pd
from sklearn.inspection import partial_dependence
from sklearn.pipeline import Pipeline

logger = logging.getLogger("explainability")

try:
    import shap
except ImportError as exc:  # pragma: no cover
    raise ImportError(
        "The 'shap' package is required for explainability features. "
        "Install it with: pip install shap"
    ) from exc


# ---------------------------------------------------------------------- #
# Shared helpers
# ---------------------------------------------------------------------- #
def _split_pipeline(pipeline: Pipeline):
    """Return (preprocessor, estimator) from a fitted sklearn Pipeline whose
    last step is the model and all prior steps are preprocessing."""
    steps = pipeline.steps
    preprocessor = Pipeline(steps[:-1]) if len(steps) > 1 else None
    estimator = steps[-1][1]
    return preprocessor, estimator


def _clean_name(name: str) -> str:
    """Strip the sklearn ColumnTransformer's 'num__' prefix for readability;
    keep other prefixes (e.g. 'cat__') since those distinguish one-hot columns."""
    return name[len("num__"):] if name.startswith("num__") else name


def _transformed_feature_names(preprocessor, fallback: Sequence[str]) -> List[str]:
    if preprocessor is None:
        return list(fallback)
    try:
        return [_clean_name(n) for n in preprocessor.get_feature_names_out()]
    except Exception:
        return list(fallback)


# ---------------------------------------------------------------------- #
# Local explainability — TreeSHAP
# ---------------------------------------------------------------------- #
class TreeShapExplainer:
    """Per-transaction SHAP attributions using TreeSHAP, for a fitted
    sklearn Pipeline (preprocessing steps + a LightGBM-family estimator)."""

    def __init__(self, pipeline: Pipeline, feature_names: Sequence[str]):
        self.pipeline = pipeline
        self.feature_names = list(feature_names)
        self._preprocessor, self._estimator = _split_pipeline(pipeline)
        self._transformed_names = _transformed_feature_names(self._preprocessor, self.feature_names)
        self._explainer = shap.TreeExplainer(self._estimator)

    def _transform(self, X: pd.DataFrame) -> np.ndarray:
        X = X[self.feature_names]
        return self._preprocessor.transform(X) if self._preprocessor is not None else X.values

    def _class_index(self, target_class: int) -> int:
        classes = list(getattr(self._estimator, "classes_", []))
        if target_class in classes:
            return classes.index(target_class)
        return int(target_class)  # fall back to treating it as a raw index

    def shap_values(self, X: pd.DataFrame, target_class: int = 1) -> np.ndarray:
        """Raw SHAP value matrix, shape (n_rows, n_transformed_features)."""
        X_t = self._transform(X)
        raw = self._explainer.shap_values(X_t)
        if isinstance(raw, list):  # one array per class (older shap API)
            return raw[self._class_index(target_class)]
        if raw.ndim == 3:  # (n_rows, n_features, n_classes) — multiclass, newer shap API
            return raw[:, :, self._class_index(target_class)]
        return raw  # binary classification: single (n_rows, n_features) array

    def explain_instance(self, features: pd.DataFrame, target_class: int = 1) -> Dict[str, float]:
        """SHAP contribution of each original feature for a single-row DataFrame."""
        values = self.shap_values(features, target_class=target_class)[0]
        return dict(zip(self._transformed_names, (float(v) for v in values)))

    def explain_batch(self, features_df: pd.DataFrame, target_class: int = 1,
                       prefix: str = "shap_") -> pd.DataFrame:
        """SHAP contribution columns (`<prefix><feature>`), one row per input row."""
        values = self.shap_values(features_df, target_class=target_class)
        cols = {f"{prefix}{name}": values[:, i] for i, name in enumerate(self._transformed_names)}
        return pd.DataFrame(cols, index=features_df.index)


# ---------------------------------------------------------------------- #
# Global explainability — feature importance
# ---------------------------------------------------------------------- #
class FeatureImportanceReporter:
    """Global feature importance for a fitted sklearn Pipeline wrapping a
    LightGBM-family estimator."""

    def __init__(self, pipeline: Pipeline, feature_names: Sequence[str]):
        self.pipeline = pipeline
        self.feature_names = list(feature_names)
        self._preprocessor, self._estimator = _split_pipeline(pipeline)
        self._transformed_names = _transformed_feature_names(self._preprocessor, self.feature_names)

    def get_importance(self, importance_type: str = "gain") -> pd.DataFrame:
        """
        importance_type : "gain" (total split gain contributed, default) or
        "split" (number of times the feature was used to split), passed
        straight through to LightGBM's booster.
        """
        booster = self._estimator.booster_
        values = booster.feature_importance(importance_type=importance_type)
        df = pd.DataFrame({"feature": self._transformed_names, "importance": values})
        return df.sort_values("importance", ascending=False).reset_index(drop=True)


# ---------------------------------------------------------------------- #
# Global explainability — PDP / ICE
# ---------------------------------------------------------------------- #
class PartialDependenceAnalyzer:
    """
    Partial Dependence (PDP) and Individual Conditional Expectation (ICE)
    curves for one or more features, computed against a reference dataset
    (e.g. a sample of already-engineered training/holdout/scored rows).
    """

    def __init__(self, pipeline: Pipeline, reference_data: pd.DataFrame, feature_names: Sequence[str]):
        self.pipeline = pipeline
        self.feature_names = list(feature_names)
        self.reference_data = reference_data[self.feature_names]

    def compute(self, feature: str, kind: str = "both", grid_resolution: int = 50) -> dict:
        """
        kind: "average" (PDP only), "individual" (ICE only), or "both".

        Returns a dict with:
            feature       : the feature name
            grid_values   : the x-axis values the feature was swept across
            pdp           : 1-D array, the average predicted response (if kind != "individual")
            ice           : 2-D array (n_reference_rows, n_grid_points) — one
                            curve per reference instance (if kind != "average")
        Ready to hand straight to a plotting/reporting layer.
        """
        if feature not in self.feature_names:
            raise ValueError(f"Unknown feature '{feature}'. Must be one of {self.feature_names}")

        result = partial_dependence(
            self.pipeline, self.reference_data, [feature],
            kind=kind, grid_resolution=grid_resolution,
        )
        output = {"feature": feature, "grid_values": result["grid_values"][0]}
        if "average" in result:
            output["pdp"] = result["average"][0]
        if "individual" in result:
            output["ice"] = result["individual"][0]
        return output

    def compute_many(self, features: Sequence[str], **kwargs) -> Dict[str, dict]:
        """Convenience: PDP/ICE for several features at once, e.g. for a report."""
        return {f: self.compute(f, **kwargs) for f in features}


# ---------------------------------------------------------------------- #
# Facade — one object for the whole pipeline to hold
# ---------------------------------------------------------------------- #
@dataclass
class FraudModelExplainer:
    """
    Bundles SHAP, feature importance, and PDP/ICE for the fraud detector
    (always) and the scenario detector (if one was trained), so callers
    only need to load and pass around a single explainer object.
    """
    feature_names: List[str]
    fraud_shap: TreeShapExplainer
    fraud_importance: FeatureImportanceReporter
    scenario_shap: Optional[TreeShapExplainer] = None
    scenario_importance: Optional[FeatureImportanceReporter] = None

    @classmethod
    def from_model_bundle(cls, model_bundle, feature_names: Sequence[str]) -> "FraudModelExplainer":
        feature_names = list(feature_names)
        fraud_shap = TreeShapExplainer(model_bundle.fraud_model, feature_names)
        fraud_importance = FeatureImportanceReporter(model_bundle.fraud_model, feature_names)

        scenario_shap = scenario_importance = None
        if model_bundle.scenario_model is not None:
            scenario_shap = TreeShapExplainer(model_bundle.scenario_model, feature_names)
            scenario_importance = FeatureImportanceReporter(model_bundle.scenario_model, feature_names)

        return cls(feature_names, fraud_shap, fraud_importance, scenario_shap, scenario_importance)

    # ---- local (per-transaction) ------------------------------------
    def explain_batch(self, features_df: pd.DataFrame, prefix: str = "shap_fraud_") -> pd.DataFrame:
        """Fraud-model SHAP contribution columns for many rows at once —
        used to enrich a batch of scored transactions."""
        return self.fraud_shap.explain_batch(features_df, target_class=1, prefix=prefix)

    def explain_transaction(self, features: pd.DataFrame, is_fraud: bool = False,
                             scenario_id: Optional[int] = None) -> Dict[str, float]:
        """Fraud-model SHAP contributions for one transaction, plus
        scenario-model SHAP contributions too if it was flagged as fraud
        and a scenario was predicted."""
        out = {f"shap_fraud_{k}": v for k, v in self.fraud_shap.explain_instance(features, target_class=1).items()}
        if is_fraud and scenario_id is not None and self.scenario_shap is not None:
            scenario_vals = self.scenario_shap.explain_instance(features, target_class=scenario_id)
            out.update({f"shap_scenario_{k}": v for k, v in scenario_vals.items()})
        return out

    # ---- global -------------------------------------------------------
    def global_feature_importance(self, model: str = "fraud", importance_type: str = "gain") -> pd.DataFrame:
        """model: "fraud" or "scenario"."""
        reporter = self.fraud_importance if model == "fraud" else self.scenario_importance
        if reporter is None:
            raise ValueError(f"No '{model}' model is available for importance reporting.")
        return reporter.get_importance(importance_type=importance_type)

    def partial_dependence(self, feature: str, reference_data: pd.DataFrame,
                            model: str = "fraud", kind: str = "both",
                            grid_resolution: int = 50) -> dict:
        """model: "fraud" or "scenario". `reference_data` should contain the
        engineered FEATURE_COLS for a representative sample of transactions
        (e.g. from `build_training_frames`, or accumulated scored batches)."""
        shap_explainer = self.fraud_shap if model == "fraud" else self.scenario_shap
        if shap_explainer is None:
            raise ValueError(f"No '{model}' model is available for partial dependence.")
        analyzer = PartialDependenceAnalyzer(shap_explainer.pipeline, reference_data, self.feature_names)
        return analyzer.compute(feature, kind=kind, grid_resolution=grid_resolution)

    def partial_dependence_many(self, features: Sequence[str], reference_data: pd.DataFrame,
                                 model: str = "fraud", **kwargs) -> Dict[str, dict]:
        return {f: self.partial_dependence(f, reference_data, model=model, **kwargs) for f in features}
