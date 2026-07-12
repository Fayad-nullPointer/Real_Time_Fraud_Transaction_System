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
        """SHAP contribution columns (`<prefix><feature>`), one row per input row,
        all explained against the SAME target_class (e.g. always class 1 =
        fraud, for the fraud model)."""
        values = self.shap_values(features_df, target_class=target_class)
        cols = {f"{prefix}{name}": values[:, i] for i, name in enumerate(self._transformed_names)}
        return pd.DataFrame(cols, index=features_df.index)

    def shap_values_per_row(self, X: pd.DataFrame, target_classes: Sequence[Optional[int]]) -> np.ndarray:
        """Like `shap_values`, but each row is explained against its OWN
        target class instead of one shared class for the whole batch.

        This is what a multiclass model (e.g. the scenario detector) needs:
        row 5 might be best explained "why does this look like scenario 2"
        while row 6 needs "why does this look like scenario 3". Rows whose
        `target_classes` entry is None get all-zero SHAP rows (nothing to
        explain — e.g. no scenario model / no prediction for that row).
        """
        n_rows = len(X)
        n_feat = len(self._transformed_names)
        out = np.zeros((n_rows, n_feat), dtype=float)
        if n_rows == 0:
            return out

        X_t = self._transform(X)
        raw = self._explainer.shap_values(X_t)

        # Normalize `raw` into a function row_idx, class -> 1D array of length n_feat
        if isinstance(raw, list):  # older shap API: one (n_rows, n_feat) array per class
            classes = list(getattr(self._estimator, "classes_", range(len(raw))))
            def _row(i, cls):
                idx = classes.index(cls) if cls in classes else int(cls)
                return raw[idx][i]
        elif raw.ndim == 3:  # newer shap API: (n_rows, n_feat, n_classes)
            classes = list(getattr(self._estimator, "classes_", range(raw.shape[2])))
            def _row(i, cls):
                idx = classes.index(cls) if cls in classes else int(cls)
                return raw[i, :, idx]
        else:  # binary classification: single (n_rows, n_feat) array
            def _row(i, cls):
                return raw[i]

        for i, cls in enumerate(target_classes):
            if cls is None:
                continue
            try:
                out[i] = _row(i, cls)
            except Exception:
                logger.warning(
                    "Could not compute per-row SHAP for row %d, target class %r — "
                    "leaving zeros for that row instead of failing the whole batch.",
                    i, cls,
                )
        return out

    def explain_batch_per_row(self, features_df: pd.DataFrame, target_classes: Sequence[Optional[int]],
                               prefix: str = "shap_") -> pd.DataFrame:
        """SHAP contribution columns (`<prefix><feature>`), one row per input
        row, each explained against its own `target_classes[i]` (see
        `shap_values_per_row`). Use this for the scenario model, where the
        "interesting" class differs per transaction."""
        if len(target_classes) != len(features_df):
            raise ValueError(
                f"target_classes has {len(target_classes)} entries but "
                f"features_df has {len(features_df)} rows — they must line up 1:1."
            )
        values = self.shap_values_per_row(features_df, target_classes)
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
        used to enrich a batch of scored transactions. Always explained
        against class 1 (fraud), since that's the one probability everyone
        cares about regardless of the transaction's outcome."""
        return self.fraud_shap.explain_batch(features_df, target_class=1, prefix=prefix)

    def explain_scenario_batch(self, features_df: pd.DataFrame, scenario_ids: Sequence[Optional[int]],
                                prefix: str = "shap_scenario_") -> pd.DataFrame:
        """Scenario-model SHAP contribution columns for many rows at once,
        each row explained against ITS OWN predicted scenario_id (from
        `FraudModelBundle.predict_batch`/`predict_one`) — populated for
        EVERY row that has a scenario_id, not only rows flagged as fraud.

        If no scenario model was trained/loaded, returns a same-shaped
        DataFrame of zeros rather than raising, so callers can always merge
        it in unconditionally."""
        if self.scenario_shap is None:
            logger.warning(
                "No scenario model loaded — returning zero-filled shap_scenario_* "
                "columns instead of failing the batch."
            )
            cols = {f"{prefix}{name}": 0.0 for name in self.feature_names}
            return pd.DataFrame(cols, index=features_df.index)
        return self.scenario_shap.explain_batch_per_row(features_df, scenario_ids, prefix=prefix)

    def explain_transaction(self, features: pd.DataFrame, is_fraud: bool = False,
                             scenario_id: Optional[int] = None) -> Dict[str, float]:
        """Fraud-model SHAP contributions for one transaction (always), PLUS
        scenario-model SHAP contributions for whichever scenario was
        predicted — populated even when `is_fraud` is False, so you can see
        *why* the scenario model leans toward a given attack pattern even on
        a transaction that wasn't flagged as fraud overall.

        `is_fraud` is accepted for backwards compatibility / logging context
        but no longer gates whether scenario SHAP is computed — only
        `scenario_id is not None` and a loaded scenario model do.
        """
        out = {f"shap_fraud_{k}": v for k, v in self.fraud_shap.explain_instance(features, target_class=1).items()}
        if scenario_id is not None and self.scenario_shap is not None:
            try:
                scenario_vals = self.scenario_shap.explain_instance(features, target_class=scenario_id)
                out.update({f"shap_scenario_{k}": v for k, v in scenario_vals.items()})
            except Exception:
                logger.exception(
                    "Scenario SHAP explanation failed for scenario_id=%s — "
                    "returning fraud SHAP only for this transaction instead of "
                    "failing the whole request.", scenario_id,
                )
        return out

    def explain_batch_full(self, features_df: pd.DataFrame, scenario_ids: Sequence[Optional[int]],
                            fraud_prefix: str = "shap_fraud_",
                            scenario_prefix: str = "shap_scenario_") -> pd.DataFrame:
        """Convenience: fraud SHAP + scenario SHAP columns for a whole batch
        in one call, side by side, ready to merge onto a results table.
        `scenario_ids` must line up 1:1 with `features_df` rows (this is
        exactly what `FraudModelBundle.predict_batch(...)["scenario_id"]`
        gives you)."""
        fraud_df = self.explain_batch(features_df, prefix=fraud_prefix)
        scenario_df = self.explain_scenario_batch(features_df, scenario_ids, prefix=scenario_prefix)
        return pd.concat([fraud_df, scenario_df], axis=1)

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