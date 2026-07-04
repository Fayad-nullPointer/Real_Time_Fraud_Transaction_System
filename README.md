# Fraud Detection Inference Pipeline

Reproduces the feature engineering from `02-preprocessing_and_feature_engineering.ipynb`
and the modeling approach from `04-engineered_features_model.ipynb` /
`05-balanced__base_model.ipynb` / `fraud_modelling_optimized.ipynb` as a
reusable, OOP, production-style pipeline.

## Files

| File | Purpose |
|---|---|
| `feature_engineering.py` | `FraudFeatureEngineer` — builds all 25 engineered features. Has a **batch** mode (`fit` + `build_training_frames`, used once to train) and a **stateful online** mode (`transform` + `register_realtime_state`, used per incoming transaction). |
| `models.py` | `FraudModelBundle` — wraps the two trained models (fraud probability + fraud scenario) with a single `predict_one` / `predict_batch` API, plus save/load. |
| `train_and_save_models.py` | Run once (or on a retraining cadence) to fit the feature engineer and train + save the best models. |
| `fraud_pipeline.py` | **The main entry point.** `FraudDetectionPipeline` — takes a new transaction, engineers its features, and returns a fraud probability + scenario prediction. |

## Two models, as requested

1. **Fraud detector** (binary): P(transaction is fraud). LightGBM inside a
   `StandardScaler + OneHotEncoder` sklearn `Pipeline`, `class_weight="balanced"`,
   with an F1-optimal decision threshold picked on the holdout split — this
   matches the approach in `04-engineered_features_model.ipynb` and the
   LightGBM configuration recommended as the production model in
   `fraud_modelling_optimized.ipynb`.

2. **Scenario detector** (multiclass, 1/2/3 = Large Amount / Skimming /
   Credential Takeover): trained on the fraud-flagged rows only, using the
   same 25 engineered features. This one wasn't saved as a standalone
   artifact in the notebooks — scenario recall was only measured as a
   breakdown of the binary model's flags — so it's newly built here as a
   dedicated LightGBM multiclass model, following the same feature set and
   pipeline style, to give you an actual "which attack pattern" model rather
   than just recall statistics. It only fires when the fraud detector flags
   a transaction.

## Why "online transform" isn't identical to the notebook's batch code

Several features (`tx_count_1h/4h`, `PREV_TX_AMOUNT_lag1/2/3`, `terminal_fraud_rate_*`,
`neigh_fraud_rate`) are computed from **rolling history**, not from a single
row. For a brand-new incoming transaction you don't have "the whole
dataframe" to roll over — so:

- **Lag / velocity features** (fast-changing, no label needed) are kept as an
  in-memory per-customer buffer (`_CustomerState`) inside `FraudFeatureEngineer`,
  updated after each transaction via `register_realtime_state`.
- **Terminal/neighborhood fraud-rate features** (slow-changing, *require*
  confirmed fraud labels from previous days) are precomputed once a day and
  cached in `terminal_risk_lookup_`. Call `refresh_daily_risk_stats(...)`
  once per day (a scheduled batch job, after fraud investigations for the
  previous day are finalized) — never at request time, so nothing about
  "today" ever leaks into scoring "today"'s transactions.

## Usage

### 1. Train once (or on a schedule) from your raw CSVs

```bash
uv run .\scripts\train_and_save_models.py
```

This produces:
```
models/feature_engineer.pkl
models/fraud_detector.joblib
models/scenario_detector.joblib
models/fraud_threshold.joblib
```

### 2. Score new transactions in real time

```python
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
```

Feed transactions **in chronological order per customer** — exactly like the
notebooks' `sort_values(["CUSTOMER_ID", "TX_DATETIME"])` — so lag/velocity
features stay correct.

### 3. CLI smoke test

```bash
python fraud_pipeline.py --artifacts-dir models --transaction-json \
  '{"TRANSACTION_ID":1,"CUSTOMER_ID":42,"TERMINAL_ID":917,"TX_DATETIME":"2026-07-05 02:14:00","TX_AMOUNT":189.5}'
```

### 4. Daily batch refresh (rolling fraud-rate features)

```python
pipeline.refresh_daily_risk_stats(newly_labeled_tx_df)   # once per day
pipeline.save_state("models")                             # persist realtime state
```

## Notes / assumptions

- Requires `pandas`, `numpy`, `scipy`, `scikit-learn`, `lightgbm`, `joblib`.
- `customer_profiles.csv` and `terminal_profiles.csv` columns are assumed
  identical to the ones already used across your notebooks
  (`x_customer_id`, `y_customer_id`, `mean_amount`, `std_amount`,
  `mean_nb_tx_per_day`, `nb_terminals`, `x_terminal_id`, `y_terminal_id`).
- `dropped columns` from `04`/`05` notebooks (`day_of_week`, `nb_terminals`,
  `mean_nb_tx_per_day`) were dropped there for a specific ablation; this
  pipeline keeps the full 25-feature set (matching notebook 02's final
  `FEATURE_COLS`) since more signal is generally better for production use.
  Drop columns in `train_and_save_models.py` if you want to match that
  ablation exactly.
