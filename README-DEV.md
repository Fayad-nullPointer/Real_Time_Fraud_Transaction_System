## Using the Trained Fraud Detection Pipeline

This guide explains how to use the trained fraud detection models inside a Jupyter notebook or any Python script.

> **Prerequisite**
>
> Before making predictions, the trained artifacts must exist inside the `models/` directory.
>
> - **If the `models/` folder does not exist**, run `train_and_save_models.py` first. This will train the models and generate all required artifacts.
> - **If the `models/` folder already exists**, you can skip the training step and proceed directly to loading the models.

---

### 1. Make the `scripts/` Directory Importable

If your notebook is **not** located inside the `scripts/` directory, add the project's `scripts/` folder to Python's module search path before importing the pipeline modules.

```python
import sys
from pathlib import Path

# Absolute path to the project root
PROJECT_ROOT = Path("/path/to/Real_Time_Fraud_Transaction_System")

# Add the scripts directory to Python's search path
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
```

For example, on Windows:

```python
import sys
from pathlib import Path

PROJECT_ROOT = Path(r"D:\Projects\Real_Time_Fraud_Transaction_System")
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
```

After adding the `scripts/` directory to `sys.path`, you can import the predictor normally:

```python
from batch_predictor import FraudBatchPredictor
```

> **Note**
>
> The notebook can be located anywhere on your machine. The only requirement is that:
>
> - `PROJECT_ROOT` points to your local copy of the repository.
> - The trained artifacts are loaded from the correct `models/` directory (for example, `PROJECT_ROOT / "models"`).

---

### 2. Import the Predictor

For inference, you only need the `FraudBatchPredictor` class.

```python
from batch_predictor import FraudBatchPredictor
```

This class automatically handles:

- Loading input data
- Feature engineering
- Running both fraud detection models
- Returning prediction results

---

### 3. Load the Trained Models

Load the trained artifacts from the project's `models/` directory.

```python
predictor = FraudBatchPredictor.from_artifacts(PROJECT_ROOT / "models")
```

This automatically loads:

- Trained `FraudFeatureEngineer`
- `FraudModelBundle`
  - Fraud classifier
  - Fraud scenario classifier
  - Saved fraud threshold

---

### 4. Prepare Your Input Data

The predictor accepts multiple input formats.

#### Single transaction

```python
tx = {
    "CUSTOMER_ID": 42,
    "TERMINAL_ID": 917,
    "TX_DATETIME": "2026-07-05 02:14:00",
    "TX_AMOUNT": 189.50,
}
```

#### Multiple transactions

```python
txs = [
    {
        "CUSTOMER_ID": 42,
        "TERMINAL_ID": 917,
        "TX_DATETIME": "2026-07-05 02:14:00",
        "TX_AMOUNT": 189.50,
    },
    {
        "CUSTOMER_ID": 42,
        "TERMINAL_ID": 12,
        "TX_DATETIME": "2026-07-05 02:20:00",
        "TX_AMOUNT": 5.00,
    },
]
```

#### CSV file

```python
csv_path = "new_transactions.csv"
```

#### Excel file

```python
xlsx_path = "new_transactions.xlsx"
```

> **Note**
>
> You do **not** need to interact directly with `input_handler.py` or `feature_engineering.py`. The predictor handles the entire preprocessing pipeline internally.

---

### 5. Run Predictions

Regardless of the input type, the prediction API is identical.

```python
results_df = predictor.predict(txs)

results_df
```

You can replace `txs` with:

- `tx`
- `csv_path`
- `xlsx_path`

using the exact same method.

---

## Prediction Output

The returned DataFrame contains the original transaction columns along with the following prediction fields:

| Column | Description |
|---------|-------------|
| `fraud_probability` | Predicted probability that the transaction is fraudulent |
| `is_fraud` | Final fraud decision using the saved threshold |
| `scenario_id` | Predicted fraud scenario ID (only populated when `is_fraud=True`) |
| `scenario_name` | Human-readable fraud scenario (Large Amount, Terminal Skimming, Credential Takeover) |
| `scenario_confidence` | Confidence score of the predicted fraud scenario |

---

## Save Predictions

To directly save the scored transactions:

```python
predictor.predict_and_save(txs, "scored.xlsx")
```

or

```python
predictor.predict_and_save(txs, "scored.csv")
```

---

## Single Transaction API (Optional)

If you're scoring only one transaction and prefer a structured result object instead of a DataFrame:

```python
from fraud_pipeline import FraudDetectionPipeline

pipeline = FraudDetectionPipeline.from_artifacts(PROJECT_ROOT / "models")

result = pipeline.process_transaction(tx)

result.to_dict()
```

This returns a convenient object representing the prediction for a single transaction.

---

## Summary

Using the trained pipeline requires only three steps:

```python
from batch_predictor import FraudBatchPredictor

predictor = FraudBatchPredictor.from_artifacts(PROJECT_ROOT / "models")

results = predictor.predict(data)
```

That's all that's needed to score transactions using the trained fraud detection pipeline.