"""
train_and_save_models.py
=========================
Run this ONCE (or whenever you want to retrain on fresh historical data) to:

  1. Fit the leakage-safe feature engineer on your raw CSVs
     (customer_profiles.csv, terminal_profiles.csv, synthetic_fraud_transactions.csv)
     — same chronological Day-140 / Day-162 split used across all four notebooks.
  2. Train the two models used downstream:
       a. Fraud detector   — LightGBM inside a StandardScaler+OneHotEncoder
                              Pipeline, class_weight="balanced"
                              (`04-engineered_features_model.ipynb` /
                              `fraud_modelling_optimized.ipynb`), with the
                              F1-optimal decision threshold picked on the
                              holdout split.
       b. Scenario detector — LightGBM multiclass model trained on the
                              fraud-only rows, predicting TX_FRAUD_SCENARIO
                              (1/2/3). Not present as a saved artifact in
                              the notebooks, but built from the same
                              engineered features so it slots into the
                              same pipeline the fraud detector uses.
  3. Persist everything under `models/`:
       models/feature_engineer.pkl
       models/fraud_detector.joblib
       models/scenario_detector.joblib
       models/fraud_threshold.joblib

Usage
-----
    python train_and_save_models.py --data-dir /path/to/csvs --out-dir models
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.metrics import f1_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from feature_engineering import FEATURE_COLS, FraudFeatureEngineer
from models import FraudModelBundle
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
)

# Get project root
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import utils.evaluation as evaluate



def find_best_threshold(y_true: pd.Series, y_prob: np.ndarray, n_steps: int = 199) -> float:
    """F1-optimal threshold search, mirroring `evaluate.find_best_threshold`
    used throughout the notebooks."""
    best_t, best_f1 = 0.5, -1.0
    for t in np.linspace(0.01, 0.99, n_steps):
        preds = (y_prob >= t).astype(int)
        f1 = f1_score(y_true, preds, zero_division=0)
        if f1 > best_f1:
            best_f1, best_t = f1, t
    return best_t


def make_preprocess(X: pd.DataFrame) -> ColumnTransformer:
    cat_cols = X.select_dtypes(include=["object", "category"]).columns
    num_cols = X.select_dtypes(exclude=["object", "category"]).columns
    return ColumnTransformer(transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=True), cat_cols),
    ])


def train_fraud_detector(train_df: pd.DataFrame, holdout_df: pd.DataFrame):
    X_train, y_train = train_df[FEATURE_COLS], train_df["TX_FRAUD"]
    X_holdout, y_holdout = holdout_df[FEATURE_COLS], holdout_df["TX_FRAUD"]

    pipe = Pipeline([
        ("preprocess", make_preprocess(X_train)),
        ("clf", LGBMClassifier(
            objective="binary",
            class_weight="balanced",
            n_estimators=200,
            learning_rate=0.05,
            min_child_samples=150,
            random_state=42,
            verbosity=-1,
        )),
    ])
    pipe.fit(X_train, y_train)

    y_prob_holdout = pipe.predict_proba(X_holdout)[:, 1]

    threshold = find_best_threshold(y_holdout, y_prob_holdout)

    y_pred_holdout = (y_prob_holdout >= threshold).astype(int)

    evaluate.evaluate_model(
        y_holdout,
        y_pred_holdout,
        y_prob_holdout,
        model_name="Fraud Detector (Holdout)"
    )

    print(f"Optimal Threshold = {threshold:.3f}")
    return pipe, threshold


def train_scenario_detector(train_df: pd.DataFrame):
    fraud_rows = train_df[train_df["TX_FRAUD"] == 1]
    if fraud_rows["TX_FRAUD_SCENARIO"].nunique() < 2:
        print("[scenario_detector] not enough distinct scenarios in training "
              "fraud rows — skipping scenario model.")
        return None

    X = fraud_rows[FEATURE_COLS]
    y = fraud_rows["TX_FRAUD_SCENARIO"]

    pipe = Pipeline([
        ("preprocess", make_preprocess(X)),
        ("clf", LGBMClassifier(
            objective="multiclass",
            num_class=int(y.nunique()),
            n_estimators=200,
            learning_rate=0.05,
            random_state=42,
            verbosity=-1,
        )),
    ])
    pipe.fit(X, y)
    print(f"[scenario_detector] trained on {len(X):,} fraud rows, "
          f"classes={sorted(y.unique())}")
    return pipe


def main():
    parser = argparse.ArgumentParser()
    SCRIPT_DIR = Path(__file__).resolve().parent
    PROJECT_ROOT = SCRIPT_DIR.parent

    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(PROJECT_ROOT / "data"),
    )

    parser.add_argument(
        "--out-dir",
        type=str,
        default=str(PROJECT_ROOT / "models"),
    )

    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)

    print("Loading raw data...")
    customer_df = pd.read_csv(data_dir / "customer_profiles.csv")
    terminal_df = pd.read_csv(data_dir / "terminal_profiles.csv")
    tx_df = pd.read_csv(data_dir / "synthetic_fraud_transactions.csv")

    realtime_path = data_dir / "realtime_transactions.csv"
    if realtime_path.exists():
        print(f"Loading and appending realtime logged transactions from {realtime_path}...")
        realtime_df = pd.read_csv(realtime_path)
        realtime_df["CUSTOMER_ID"] = realtime_df["CUSTOMER_ID"].astype(int)
        realtime_df["TERMINAL_ID"] = realtime_df["TERMINAL_ID"].astype(int)
        realtime_df["TX_AMOUNT"] = realtime_df["TX_AMOUNT"].astype(float)
        realtime_df["TX_TIME_SECONDS"] = realtime_df["TX_TIME_SECONDS"].astype(int)
        realtime_df["TX_TIME_DAYS"] = realtime_df["TX_TIME_DAYS"].astype(int)
        realtime_df["TX_FRAUD"] = realtime_df["TX_FRAUD"].astype(int)
        realtime_df["TX_FRAUD_SCENARIO"] = realtime_df["TX_FRAUD_SCENARIO"].astype(int)
        
        tx_df = pd.concat([tx_df, realtime_df], ignore_index=True)

    tx_df["TX_DATETIME"] = pd.to_datetime(tx_df["TX_DATETIME"])

    print("Fitting feature engineer (learns peer groups, terminal risk stats, "
          "spatial neighbor graph — train-only, leakage-safe)...")
    fe = FraudFeatureEngineer().fit(customer_df, terminal_df, tx_df)

    print("Building train / holdout / OOT feature frames...")
    train_df, holdout_df, oot_df = fe.build_training_frames(tx_df)
    print(f"  train={len(train_df):,}  holdout={len(holdout_df):,}  oot={len(oot_df):,}")

    print("Training fraud detector (LightGBM, engineered features)...")
    fraud_model, threshold = train_fraud_detector(train_df, holdout_df)

    # sanity check on OOT
    y_prob_oot = fraud_model.predict_proba(oot_df[FEATURE_COLS])[:, 1]
    y_pred_oot = (y_prob_oot >= threshold).astype(int)
    evaluate.evaluate_model(
        oot_df["TX_FRAUD"],
        y_pred_oot,
        y_prob_oot,
        model_name="Fraud Detector (OOT)"
    )

    print("Training scenario detector (LightGBM multiclass, fraud rows only)...")
    scenario_model = train_scenario_detector(train_df)

    print(f"Saving artifacts to {out_dir}/ ...")
    fe.save(out_dir / "feature_engineer.pkl")
    FraudModelBundle(fraud_model, scenario_model, threshold).save(out_dir)
    print("Done.")


if __name__ == "__main__":
    main()
