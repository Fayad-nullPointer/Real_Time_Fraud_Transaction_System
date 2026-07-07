# Fraud Detection Inference Pipeline

An OOP, production-style pipeline that reproduces the feature engineering
from `02-preprocessing_and_feature_engineering.ipynb` and the modeling
approach from `04-engineered_features_model.ipynb` /
`05-balanced__base_model.ipynb` / `fraud_modelling_optimized.ipynb`.

Every file has exactly one job. None of them know how the others do theirs
— they're wired together through small, explicit interfaces, so you can
test, replace, or reuse any single piece independently.

## Files

| File | Responsibility |
|---|---|
| `input_handler.py` | Accepts new transaction data as a **dict, list of dicts, CSV file, or Excel file**, and validates it against the required raw schema. Knows nothing about feature engineering or models. |
| `feature_engineering.py` | `FraudFeatureEngineer` — computes all 25 engineered features, exactly as done in training. Has a **batch** mode (`fit` + `build_training_frames`, used once to train) and a **stateful online** mode (`transform` + `register_realtime_state`, used per incoming transaction). Doesn't know where the input came from or what happens to its output. |
| `models.py` | `FraudModelBundle` — the class responsible for **loading the two trained models and the saved fraud-decision threshold**, and turning a row of engineered features into a fraud probability + (if flagged) a fraud-scenario prediction. Doesn't know how the input was read or engineered. |
| `train_and_save_models.py` | Run once (or on a retraining cadence) against your raw CSVs to fit the feature engineer and train + save both models. |
| `batch_predictor.py` | **Orchestrator for offline/batch scoring.** Wires `input_handler.py` → `feature_engineering.py` → `models.py` together for a dict, list, CSV, or Excel file of new transactions, and can export the scored results to CSV/Excel. |
| `fraud_pipeline.py` | **Orchestrator for real-time, one-at-a-time scoring** (e.g. behind a FastAPI endpoint or a Kafka consumer). Same building blocks as `batch_predictor.py`, just optimized for scoring a single transaction as it arrives. |

## The two models, as requested

1. **Fraud detector** (binary): P(transaction is fraud). LightGBM inside a
   `StandardScaler + OneHotEncoder` sklearn `Pipeline`, `class_weight="balanced"`,
   with an F1-optimal decision threshold picked on the holdout split — matching
   `04-engineered_features_model.ipynb` and the LightGBM configuration
   recommended in `fraud_modelling_optimized.ipynb`.
2. **Scenario detector** (multiclass: 1 = Large Amount, 2 = Terminal Skimming,
   3 = Credential Takeover): trained on fraud-flagged rows only, using the same
   25 engineered features. Only fires when the fraud detector flags a
   transaction. Both models and the threshold are loaded and served by the
   single `FraudModelBundle` class in `models.py`.

---

## 1. What data you need to provide

Every new-transaction input — regardless of shape — must contain these
raw fields (see `input_handler.RAW_TX_SCHEMA`):

| Field | Required? | Description |
|---|---|---|
| `TRANSACTION_ID` | optional | Any identifier (int/str). Auto-generated if missing. Must be unique within one batch. |
| `CUSTOMER_ID` | **required** | Must match a customer the pipeline was trained/fitted on (i.e. exists in `customer_profiles.csv`). |
| `TERMINAL_ID` | **required** | Must match a terminal the pipeline was trained/fitted on (i.e. exists in `terminal_profiles.csv`). |
| `TX_DATETIME` | **required** | Parseable date/time, e.g. `"2026-07-05 02:14:00"`. |
| `TX_AMOUNT` | **required** | Numeric, must be `> 0`. |

Any other columns you include are simply ignored — everything else (`distance`,
`Z_score`, rolling velocity, terminal fraud rates, lag ratios, etc.) is
computed automatically from these five fields plus the fitted customer/terminal
profiles, exactly the way `02-preprocessing_and_feature_engineering.ipynb`
computes them at training time.

`input_handler.py` will raise a clear `InputValidationError` (missing
column, unparseable date, non-numeric or non-positive amount, null IDs,
duplicate `TRANSACTION_ID`) before anything reaches the model, so bad data
never silently produces a meaningless prediction.

### The four accepted input shapes

```python
# 1) a single transaction as a dict
tx = {"CUSTOMER_ID": 42, "TERMINAL_ID": 917,
      "TX_DATETIME": "2026-07-05 02:14:00", "TX_AMOUNT": 189.50}

# 2) a list of dicts (multiple transactions)
txs = [
    {"CUSTOMER_ID": 42, "TERMINAL_ID": 917, "TX_DATETIME": "2026-07-05 02:14:00", "TX_AMOUNT": 189.50},
    {"CUSTOMER_ID": 42, "TERMINAL_ID": 12,  "TX_DATETIME": "2026-07-05 02:20:00", "TX_AMOUNT": 5.00},
]

# 3) a CSV file with those same columns as headers
"new_transactions.csv"

# 4) an Excel file with those same columns as headers
"new_transactions.xlsx"
```

---

## 2. Train once and save the artifacts

```bash
python train_and_save_models.py --data-dir /path/to/data --out-dir models
```

`--data-dir` must contain `customer_profiles.csv`, `terminal_profiles.csv`,
and `synthetic_fraud_transactions.csv` (the same raw files the notebooks use).

This produces, under `models/`:
```
feature_engineer.pkl      # fitted FraudFeatureEngineer (peer groups, terminal
                           # risk lookups, spatial neighbor graph, profiles)
fraud_detector.joblib      # trained binary LightGBM pipeline
scenario_detector.joblib   # trained multiclass LightGBM pipeline
fraud_threshold.joblib     # F1-optimal decision threshold from the holdout split
```

## 3. Score new transactions — batch (dict / list / CSV / Excel)

```python
from batch_predictor import FraudBatchPredictor

predictor = FraudBatchPredictor.from_artifacts("models")

# a single dict
result = predictor.predict({
    "CUSTOMER_ID": 42, "TERMINAL_ID": 917,
    "TX_DATETIME": "2026-07-05 02:14:00", "TX_AMOUNT": 189.50,
})

# a list of dicts
results = predictor.predict([...])

# a CSV or Excel file
results = predictor.predict("new_transactions.csv")

# score + write the results straight to a file
results = predictor.predict_and_save("new_transactions.xlsx", "scored_transactions.xlsx")
```

Each returned row keeps your original input columns and adds:
`fraud_probability`, `is_fraud`, `scenario_id`, `scenario_name`, `scenario_confidence`.

You can also run it from the command line:

```bash
python batch_predictor.py --artifacts-dir models --input new_transactions.csv --output scored.csv
python batch_predictor.py --artifacts-dir models --input new_transactions.xlsx --output scored.xlsx
python batch_predictor.py --artifacts-dir models --input transactions.json   # a JSON file containing a list of dicts
```

If you pass multiple transactions for the same customer, feed them in
chronological order (`batch_predictor.py` sorts by `CUSTOMER_ID`/`TX_DATETIME`
internally, but keep this in mind if you're chaining multiple separate calls).

## 4. Score new transactions — one at a time, real time

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

Use `fraud_pipeline.py` for a live request/response path (e.g. a FastAPI
endpoint scoring one transaction as it arrives) and `batch_predictor.py` for
scoring many transactions at once from a file — they share the exact same
`FraudFeatureEngineer` and `FraudModelBundle` underneath, so results are
identical either way.

## 5. Why "online" feature computation isn't identical to the notebook's batch code

Several features (`tx_count_1h/4h`, `PREV_TX_AMOUNT_lag1/2/3`,
`terminal_fraud_rate_*`, `neigh_fraud_rate`) are computed from **rolling
history**, not from a single row. For a brand-new incoming transaction you
don't have "the whole dataframe" to roll over — so:

- **Lag / velocity features** (fast-changing, no label needed) are kept as an
  in-memory per-customer buffer inside `FraudFeatureEngineer`, updated after
  each transaction.
- **Terminal / neighborhood fraud-rate features** (slow-changing, *require*
  confirmed fraud labels from previous days) are precomputed once a day and
  cached. Call `refresh_daily_risk_stats(...)` (on either orchestrator) once
  per day — a scheduled batch job, after fraud investigations for the
  previous day are finalized — never at request time, so nothing about
  "today" ever leaks into scoring "today"'s transactions.

## Notes / requirements

- Requires `pandas`, `numpy`, `scipy`, `scikit-learn`, `lightgbm`, `joblib`,
  and `openpyxl` (for `.xlsx` reading/writing).
- `customer_profiles.csv` / `terminal_profiles.csv` must have the same
  columns already used across your notebooks (`x_customer_id`,
  `y_customer_id`, `mean_amount`, `std_amount`, `mean_nb_tx_per_day`,
  `nb_terminals`, `x_terminal_id`, `y_terminal_id`).
- This pipeline uses the full 25-feature set (matching notebook 02's final
  `FEATURE_COLS`), not the reduced ablation set used in some of the
  `04`/`05` notebook cells.
