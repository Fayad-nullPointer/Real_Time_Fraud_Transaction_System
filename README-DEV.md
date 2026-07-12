# Real-Time Fraud Transaction System — ML Scoring Layer

This README documents the **fraud-scoring core** of the Real-Time Fraud Transaction
System: the Python modules that turn a raw transaction into a fraud probability,
scenario label, and (optionally) an explanation — the piece that everything else in
the architecture (GUI, Kafka, Dashboard, xAI/Alerting, OTP, LLM report) plugs into.

It's written for the developer who needs to **wrap this code in an API** (FastAPI,
Flask, a Kafka consumer, etc.) without having to read every module from scratch.

---

## 1. Where this fits in the architecture

```
GUI (Name, Card, Phone, Password + Transaction data)
        │
        ▼
Mock Credentials DB ──► Kafka (Producer/Consumer, mimics live transactions)
                              │
                              ▼
                    ┌───────────────────────┐
                    │   THIS LAYER          │
                    │  Feature Engineering  │
                    │  → Base Fraud Model   │
                    │  → 0 = legit / 1 = fraud
                    └───────────────────────┘
                              │
              ┌───────────────┼────────────────────┐
              ▼                                    ▼
      Transaction Approved                  Post-Hoc Part
      (0 - legitimate)                 (xAI / SHAP + Criteria)
                                                 │
                                                 ▼
                                        Dashboard + Logs + Alert
                                                 │
                                    ┌────────────┴────────────┐
                                    ▼                         ▼
                              Send OTP (Twilio)        LLM/RAG report
                              True/False decision      for System Admin
```

The modules described below implement the **Feature Engineering → Base Model →
Post-Hoc (xAI)** box. Everything to the right of it (Dashboard, Twilio OTP, RAG
report generation, System Admin UI) is a *consumer* of the JSON this layer returns —
your job when exposing this as an API is to return the right fields so those
downstream pieces can be wired up.

---

## 2. Prerequisites & installation (uv)

This project uses **[uv](https://docs.astral.sh/uv/)** for environment and
dependency management. Do not use raw `pip install` — always go through `uv` so the
lockfile stays consistent for every developer and for CI.

```bash
# 1. Clone the repo, then from the project root:
uv sync
```

`uv sync` reads `pyproject.toml` + `uv.lock` and creates/updates a local
`.venv` with the exact pinned versions everyone else is using (pandas, numpy,
scikit-learn/XGBoost or LightGBM, shap, joblib, etc.). Run it:

- The first time you clone the repo.
- Any time you `git pull` and `pyproject.toml` / `uv.lock` changed.
- After adding a new dependency yourself (`uv add <package>`, e.g. `uv add shap`).

To run any script or notebook inside the managed environment:

```bash
uv run python train_and_save_models.py --data-dir data --out-dir models
uv run jupyter lab      # to open the walkthrough notebook
uv run uvicorn api.main:app --reload   # once you've built the API wrapper
```

`uv run <cmd>` automatically uses the synced `.venv` — you don't need to manually
activate it, though `source .venv/bin/activate` (or `uv venv` first, on a fresh
machine) also works if you prefer an activated shell.

### Make the `scripts/` directory importable

The pipeline modules (`fraud_pipeline.py`, `batch_predictor.py`,
`feature_engineering.py`, etc.) live inside the project's `scripts/` folder. If
your notebook or script is **not** already located inside `scripts/`, add it to
Python's module search path before importing anything:

```python
import sys
from pathlib import Path

PROJECT_ROOT = Path("/path/to/Real_Time_Fraud_Transaction_System")   # your local clone

sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
```

On Windows this looks like:

```python
PROJECT_ROOT = Path(r"D:\Projects\Real_Time_Fraud_Transaction_System")
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
```

Once that's done, the imports used throughout this README (`from fraud_pipeline
import FraudDetectionPipeline`, `from batch_predictor import FraudBatchPredictor`)
work normally, regardless of where your notebook/script physically lives. The only
two things that matter are:

- `PROJECT_ROOT` points at your local copy of the repo.
- Artifacts are loaded from the correct `models/` directory, e.g.
  `PROJECT_ROOT / "models"` (both a `Path` object and a plain string path work
  with `from_artifacts`).

### Required model artifacts

Before any of the code below will load, these files must exist (produced once by
the training script):

```
models/feature_engineer.pkl
models/fraud_detector.joblib
models/scenario_detector.joblib
models/fraud_threshold.joblib
```

If they don't exist yet:

```bash
uv run python train_and_save_models.py --data-dir data --out-dir models
```

`shap` must be installed (it's a project dependency, so `uv sync` handles it) for
any of the explainability features to work.

---

## 3. Module map

| Module | Main class / entry point | Purpose |
|---|---|---|
| `feature_engineering.py` | `FraudFeatureEngineer` | Turns a raw transaction dict into the model-ready engineered feature row (lags, velocity, risk scores, etc.), and holds **realtime per-customer state** (in-memory buffers). |
| `models.py` | `FraudModelBundle` | Loads/holds the trained fraud model, scenario model, and decision threshold. |
| `explainability.py` | `FraudModelExplainer` | SHAP explanations, gain-based feature importance, PDP/ICE. |
| `fraud_pipeline.py` | `FraudDetectionPipeline` | **Real-time, single-transaction, stateful** path — this is the one you wire into an API endpoint or a Kafka consumer. |
| `batch_predictor.py` | `FraudBatchPredictor` | **Batch** path — score a dict, list of dicts, DataFrame, or a CSV/Excel file at once. Also exposes feature importance and PDP/ICE. |
| `input_handler.py` | `TransactionInputLoader` | Normalizes any of the above input shapes into a single DataFrame format internally. You generally don't call this directly — `FraudBatchPredictor.predict()` uses it for you. |
| `train_and_save_models.py` | CLI script | One-time (or periodic retraining) script that fits the feature engineer + models and writes the four artifact files above. |

In production you would typically only load **one** of `FraudDetectionPipeline` or
`FraudBatchPredictor` per process (they both load the same underlying artifacts) —
e.g. `FraudDetectionPipeline` inside your real-time API/Kafka-consumer process, and
`FraudBatchPredictor` inside a nightly/batch scoring job or an admin "re-score a CSV"
endpoint.

---

## 4. `FraudDetectionPipeline` — the real-time path

This is what a single API request (or a single Kafka message) should call.

### Loading it (once, at process startup)

```python
from fraud_pipeline import FraudDetectionPipeline

pipeline = FraudDetectionPipeline.from_artifacts("models")
```

- `FraudDetectionPipeline.from_artifacts(artifacts_dir, load_explainer=True)` —
  classmethod. Loads `feature_engineer.pkl` + the model bundle from `artifacts_dir`.
  Pass `load_explainer=False` if you don't need SHAP for this process (e.g. a
  lightweight scoring-only replica) — it skips building the `FraudModelExplainer`,
  which is faster to start and uses less memory.
- After loading you have access to:
  - `pipeline.model_bundle` — the `FraudModelBundle` (`.fraud_model`,
    `.scenario_model` — `scenario_model` may be `None` if you don't use it).
  - `pipeline.feature_engineer` — the `FraudFeatureEngineer` holding realtime state.
  - `pipeline.explainer` — the `FraudModelExplainer`, or `None` if
    `load_explainer=False`.

### Scoring one transaction

```python
new_tx = {
    "TRANSACTION_ID": 900001,
    "CUSTOMER_ID": 42,        # must exist in customer_profiles.csv
    "TERMINAL_ID": 917,       # must exist in terminal_profiles.csv
    "TX_DATETIME": "2026-07-05 02:14:00",
    "TX_AMOUNT": 110.50,
}

prediction = pipeline.process_transaction(new_tx, update_state=True)
result = prediction.to_dict()
```

`process_transaction(tx: dict, update_state: bool = True, explain: bool = False)`:

1. Engineers features for that one transaction (lags, rolling velocity, terminal/
   customer risk rates, etc.).
2. Scores fraud probability (and the scenario model, if loaded).
3. If `update_state=True`, updates that customer's realtime lag/velocity buffers
   with this transaction — **use `update_state=True` in production** so the next
   transaction from the same customer sees correct history. Use `False` only for
   dry-runs / re-scoring / notebook experimentation where you don't want to mutate
   state.
4. Returns a `prediction` object. Call `.to_dict()` on it to get a plain,
   JSON-serializable dict — this is what you return from an API endpoint. Fields
   include: `fraud_probability`, `is_fraud`, `scenario_id`, `scenario_name`,
   `scenario_confidence` (plus whatever transaction fields you passed in, e.g.
   `TRANSACTION_ID` if you included one).

   **Important:** `scenario_id`, `scenario_name`, and `scenario_confidence` are
   only populated when `is_fraud=True` — a legitimate transaction won't have a
   scenario attached. `scenario_name` is one of the trained scenario labels:
   `"Large Amount"`, `"Terminal Skimming"`, or `"Credential Takeover"`.

To get a SHAP explanation for the same call, pass `explain=True` — the return value
becomes a `(prediction, explanation)` tuple:

```python
prediction, explanation = pipeline.process_transaction(new_tx, update_state=True, explain=True)

fraud_shap = {k: v for k, v in explanation.items() if k.startswith("shap_fraud_")}
top8 = sorted(fraud_shap.items(), key=lambda kv: abs(kv[1]), reverse=True)[:8]
```

`explanation` is a flat dict of `shap_fraud_<feature>: value` (and
`shap_scenario_<feature>: value` if the scenario model is loaded) — perfect for
feeding straight into the "Post-Hoc / xAI" and "Criteria → Alert" stages of the
architecture.

### Warm start — critical for API/Kafka processes that restart

The lag features (`PREV_TX_AMOUNT_lag1/2/3`) and velocity features
(`tx_count_1h`, `tx_count_4h`, `night_velocity`) live in **in-memory state**. A
fresh process (new deploy, pod restart, new replica) has no memory of returning
customers, so it will silently cold-start them (wrong/low-confidence scores) unless
you seed that state on startup.

```python
# One customer, from a small slice of their recent history:
pipeline.warm_start_customer(customer_id=42, history_df=history_df)   # -> bool, was it warmed?
pipeline.is_warm(42)                                                  # -> bool

# All returning customers at once, at process startup:
report = pipeline.warm_start_from_history(bulk_history_df)
# report tells you who was warmed vs. skipped (e.g. unknown customer IDs)
```

`history_df` needs (at minimum) `TX_DATETIME` and `TX_AMOUNT` columns for the
customer(s) in question — e.g. pulled from your transactions table for the last
few hours before the process starts. `warm_start_customer` / `warm_start_from_history`
are **idempotent** — calling them again for the same customer/history does not
double-count.

**Recommended startup sequence for an API process:**

```python
pipeline = FraudDetectionPipeline.from_artifacts("models")
recent_history = load_recent_transactions_from_db()   # your own query
pipeline.warm_start_from_history(recent_history)
# now start serving requests
```

### Persisting state

If you want a restart to resume warm *without* re-querying history (or to persist
what was learned during live scoring with `update_state=True`), call:

```python
pipeline.save_state("models")   # rewrites models/feature_engineer.pkl with accumulated buffers
```

Call this periodically (e.g. on a timer, or on graceful shutdown), not on every
request — it's an I/O operation, not something to run per-transaction.

---

## 5. `FraudBatchPredictor` — batch / bulk path

Use this for anything that isn't "one transaction at a time": scoring a CSV upload
from the admin GUI, a nightly re-score job, feature-importance dashboards, PDP/ICE
charts, etc.

### Loading it

```python
from batch_predictor import FraudBatchPredictor

predictor = FraudBatchPredictor.from_artifacts("models")
```

Same artifact directory as `FraudDetectionPipeline`.

### Scoring — accepts dict, list-of-dicts, DataFrame, or a file path

```python
predictor.predict(new_tx)                 # single dict
predictor.predict([tx1, tx2, tx3])         # list of dicts
predictor.predict(some_dataframe)          # pandas DataFrame
predictor.predict("transactions.csv")      # CSV path
predictor.predict("transactions.xlsx")     # Excel path
```

`predict(data, update_state=False, include_explanations=True)` returns a
**pandas DataFrame** — one row per transaction, including your original
transaction columns, plus:

| Column | Description |
|---|---|
| `fraud_probability` | Predicted probability that the transaction is fraudulent |
| `is_fraud` | Final fraud decision, using the saved threshold |
| `scenario_id` | Predicted fraud scenario ID — **only populated when `is_fraud=True`** |
| `scenario_name` | Human-readable scenario — one of `"Large Amount"`, `"Terminal Skimming"`, `"Credential Takeover"` — only populated when `is_fraud=True` |
| `scenario_confidence` | Confidence score of the predicted scenario — only populated when `is_fraud=True` |
| `shap_fraud_<feature>` / `shap_scenario_<feature>` | Per-feature SHAP contributions, one column per engineered feature — only present when `include_explanations=True` (the default) |

You don't need to touch `input_handler.py` or `feature_engineering.py` directly —
`predict()` handles loading, feature engineering, and running both models
internally, regardless of which input shape you pass it.

- Set `include_explanations=False` for large batches where you don't need SHAP —
  it's noticeably faster.
- `update_state` behaves the same as in `FraudDetectionPipeline`: set `True` if this
  batch represents real transactions that should affect future realtime scoring for
  those customers; leave `False` for re-scoring/backtesting/what-if runs.

To convert a DataFrame result into API-friendly JSON:

```python
result_df = predictor.predict(payload, update_state=False)
result_json = result_df.to_dict(orient="records")   # -> list[dict], one per transaction
```

### Score and save in one call

```python
predictor.predict_and_save("transactions.csv", "scored_output.xlsx", update_state=False)
```

Useful for an admin "upload a CSV, download the scored file" endpoint — writes
directly to `.csv` or `.xlsx` depending on the output path's extension, and also
returns the scored DataFrame.

### Global feature importance

```python
fraud_importance = predictor.get_feature_importance(model="fraud", importance_type="gain")
scenario_importance = predictor.get_feature_importance(model="scenario", importance_type="gain")  # if scenario model is loaded
```

Returns a DataFrame with `feature` / `importance` columns, sorted descending —
good for a "why does the model behave this way overall" dashboard panel,
independent of any specific transaction. Guard the scenario call behind
`predictor.model_bundle.scenario_model is not None`, since that model is optional.

### Partial Dependence / ICE (for a dashboard "what-if" chart)

```python
pdp_ice = predictor.compute_partial_dependence(
    "TX_AMOUNT", model="fraud", kind="both", grid_resolution=50
)
# -> dict with keys like: "feature", "grid_values", "pdp", "ice"
```

- **Needs a reference sample of already-engineered rows.** If you don't pass one
  explicitly, it reuses the features from the **most recent** `predict()` call
  (cached internally as `predictor._last_scored_features`) — so call `predict()`
  on a representative batch first if you're building a standalone "explore this
  feature" endpoint.
- For several features at once, use the explainer directly:
  ```python
  many = predictor.explainer.partial_dependence_many(
      ["Z_score", "distance", "terminal_fraud_rate_7d"],
      predictor._last_scored_features,
      model="fraud", kind="both", grid_resolution=50,
  )
  # -> dict keyed by feature name, each value shaped like the single-feature result above
  ```

### Persisting state

Same as the real-time pipeline:

```python
predictor.save_state("models")
```

---

## 6. `FraudFeatureEngineer` (advanced / internal use)

You normally reach this only through `pipeline.feature_engineer`, not directly. Two
methods worth knowing if you need finer control (e.g. custom warm-start logic, or
inspecting exactly what features go into the model):

- `feature_engineer.transform(tx: dict) -> pandas.DataFrame` — engineers features
  for one transaction **without** scoring it or mutating state. Useful for
  debugging/inspecting what the model actually sees.
- `feature_engineer.register_realtime_state(tx: dict)` — updates the in-memory
  per-customer buffers **without** scoring — this is what `warm_start_customer`
  uses under the hood when replaying history.

---

## 7. Exposing this as an API — recommended shape

A minimal FastAPI wrapper, showing where each piece plugs in:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel

from fraud_pipeline import FraudDetectionPipeline

ARTIFACTS_DIR = "models"
pipeline: FraudDetectionPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline
    pipeline = FraudDetectionPipeline.from_artifacts(ARTIFACTS_DIR)
    recent_history = load_recent_transactions_from_db()  # your own query
    pipeline.warm_start_from_history(recent_history)
    yield
    pipeline.save_state(ARTIFACTS_DIR)


app = FastAPI(lifespan=lifespan)


class Transaction(BaseModel):
    TRANSACTION_ID: int
    CUSTOMER_ID: int
    TERMINAL_ID: int
    TX_DATETIME: str
    TX_AMOUNT: float


@app.post("/score")
def score_transaction(tx: Transaction, explain: bool = False):
    if explain:
        prediction, explanation = pipeline.process_transaction(
            tx.model_dump(), update_state=True, explain=True
        )
        return {**prediction.to_dict(), "shap": explanation}
    prediction = pipeline.process_transaction(tx.model_dump(), update_state=True)
    return prediction.to_dict()
```

For batch endpoints (CSV upload, admin re-score, dashboards), add a second router
backed by `FraudBatchPredictor` following the same `from_artifacts` /
`warm_start_from_history` pattern at startup, and use `.predict(...).to_dict(orient="records")`
or `.predict_and_save(...)` for the response.

### Mapping to the rest of the architecture

| Downstream component (from the diagram) | Field(s) to send it |
|---|---|
| Transaction Approved / rejected path | `is_fraud` (0 = legitimate, 1 = fraud) |
| Dashboard / Logs | full `prediction.to_dict()` payload, logged per request |
| Post-Hoc / xAI / Criteria / Alert | the `shap_fraud_*` / `shap_scenario_*` explanation dict |
| Send OTP (Twilio) decision (True/False) | typically gated on `is_fraud` (or `fraud_probability` vs. your own threshold) — that decision logic lives in the service calling this API, not in these modules |
| LLM/RAG generated report for System Admin | feed it the prediction + SHAP explanation as context |

---

## 8. Quick reference — all the calls in one place

```python
# --- Setup (once per process) ---
from fraud_pipeline import FraudDetectionPipeline
from batch_predictor import FraudBatchPredictor

pipeline = FraudDetectionPipeline.from_artifacts("models")      # real-time
predictor = FraudBatchPredictor.from_artifacts("models")        # batch

# --- Warm start (once per process, at startup) ---
pipeline.warm_start_from_history(recent_history_df)

# --- Real-time scoring (per request / per Kafka message) ---
prediction = pipeline.process_transaction(tx, update_state=True)
prediction.to_dict()

prediction, shap_values = pipeline.process_transaction(tx, update_state=True, explain=True)

# --- Batch scoring ---
predictor.predict(tx_or_list_or_df_or_filepath, update_state=False)
predictor.predict_and_save(input_path, output_path, update_state=False)

# --- Model introspection (for dashboards) ---
predictor.get_feature_importance(model="fraud", importance_type="gain")
predictor.compute_partial_dependence("TX_AMOUNT", model="fraud", kind="both")

# --- Persistence ---
pipeline.save_state("models")
predictor.save_state("models")

# --- Retraining (offline/CLI) ---
# uv run python train_and_save_models.py --data-dir data --out-dir models
```

---

## 9. Common pitfalls

- **Forgetting warm start** — a freshly-deployed process will under- or
  mis-score returning customers until you call `warm_start_from_history` (or it
  naturally re-learns state after enough live traffic with `update_state=True`).
- **`update_state=False` in production** — fine for notebooks/dry-runs, wrong for
  live traffic. Real requests should use `update_state=True` so lag/velocity
  features stay accurate for that customer's next transaction.
- **Missing model artifacts** — `from_artifacts` will fail if
  `models/feature_engineer.pkl`, `models/fraud_detector.joblib`,
  `models/scenario_detector.joblib`, or `models/fraud_threshold.joblib` are
  missing. Run `train_and_save_models.py` first.
- **`compute_partial_dependence` with no prior `predict()` call** — it needs a
  reference sample; call `predictor.predict(...)` on a representative batch first,
  or the cached `_last_scored_features` will be empty/stale.
- **`scenario_model` may be `None`** — it's optional; guard scenario-specific
  calls (`get_feature_importance(model="scenario", ...)`, scenario SHAP) behind
  `predictor.model_bundle.scenario_model is not None`.
- **Expecting scenario fields on legitimate transactions** — `scenario_id`,
  `scenario_name`, and `scenario_confidence` are only populated when
  `is_fraud=True`. Don't treat a missing/null scenario as an error for legit
  transactions — that's expected.