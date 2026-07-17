# 🛡️ Real-Time Fraud Detection Inference Pipeline

Welcome to the production-ready inference pipeline for our Fraud Detection project! This repository contains the object-oriented, reusable machinery required to take raw transactions, engineer features on the fly, and run them through our trained models to predict and categorize fraudulent activity.

This documentation is tailored to help developer teammates understand the architecture, get the models running locally, and effectively perform inference.

---

## 🚀 Added Feature: Real-Time SHAP Explainability (`top_fraud_reasons`)

We have introduced **TreeSHAP Explainability** directly into the inference pipeline! When a transaction is flagged as fraud, the pipeline doesn't just return a binary flag or probability—it now provides the **Top 3 contributing features** that led to the fraud decision. 

This transparency is invaluable for risk investigators, debugging, and auditing our model's decisions. 

**Example output for a flagged transaction:**
```json
{
  "TRANSACTION_ID": 123456,
  "fraud_probability": 0.87,
  "is_fraud": true,
  "scenario_id": 3,
  "scenario_name": "Credential Takeover",
  "scenario_confidence": 0.74,
  "top_fraud_reasons": {
    "PREV_TX_AMOUNT_lag1": 2.4153,
    "tx_count_1h": 1.1892,
    "terminal_fraud_rate_1d": 0.8921
  }
}
```

---

## 📱 Added Feature: Twilio WhatsApp OTP Verification

To close the loop on real-time fraud mitigation, the pipeline integrates directly with the **Twilio WhatsApp API**.

When a transaction is flagged as fraud (`is_fraud == True`), the following automated workflow is triggered:
1. **OTP Generation:** The system instantly generates a secure 6-digit OTP.
2. **WhatsApp Alert:** A customized alert is sent via WhatsApp to the user's registered phone number (pulled from the transaction payload). It includes the exact transaction amount and terminal ID.
3. **Pending State:** The inference pipeline enters a **Pending State**, suspending the transaction until the user types the exact OTP into their interface to confirm the purchase. 

This ensures that high-risk transactions are verified by a human-in-the-loop (the actual cardholder) before any money is lost.

---

## 🛠️ System Architecture

### 1. The Models
The pipeline incorporates two models inside `FraudModelBundle`:
1. **Fraud Detector (Binary):** A LightGBM classifier embedded in a `scikit-learn` pipeline (`StandardScaler` + `OneHotEncoder`). It predicts `P(transaction is fraud)` and evaluates it against an F1-optimal threshold.
2. **Scenario Detector (Multiclass):** Trained exclusively on fraud-flagged rows. If a transaction is identified as fraud, this model classifies the attack pattern (Large Amount, Skimming, or Credential Takeover).

### 2. Real-Time Feature Engineering
Notebook code operates on batch logic (using `.shift()` or `.rolling()`), but incoming transactions arrive one by one. The `FraudFeatureEngineer` elegantly bridges this gap:
- **Fast-changing Lag/Velocity Features:** Managed using an in-memory, per-customer buffer (`_CustomerState`) that updates after every transaction.
- **Slow-changing Fraud-Rate Features:** (e.g., terminal/neighborhood risk) Are precomputed daily via a scheduled batch job so that future leakages are prevented.

---

## 💻 How to Run Inference

There are a few distinct ways to run inference, depending on your needs.

### Method A: Running the Dedicated Inference Script (Recommended for Testing)

We provide a dedicated `inference.py` script specifically designed to test different transaction scenarios (Normal vs. Large Amount vs. Skimming vs. Credential Takeover) and verify the outputs, including the new TreeSHAP explanations.

```bash
# Run the inference script
uv run inference.py
# OR
python inference.py
```
*Note: Ensure your `full dataset with brief/synthetic_fraud_transactions.csv` is populated with the required data.*

### Method B: Integrating into Your App (Python API)

If you are wiring this pipeline into a FastAPI endpoint, Kafka consumer, or background worker, import and utilize the `FraudDetectionPipeline`.

```python
from scripts.fraud_pipeline import FraudDetectionPipeline

# 1. Load the pre-trained artifacts (feature engineer, models, threshold)
pipeline = FraudDetectionPipeline.from_artifacts("models")

# 2. Define your raw incoming transaction
new_tx = {
    "TRANSACTION_ID": 123456,
    "CUSTOMER_ID": 42,
    "TERMINAL_ID": 917,
    "TX_DATETIME": "2026-07-05 02:14:00",
    "TX_AMOUNT": 189.50,
}

# 3. Process the transaction end-to-end
prediction = pipeline.process_transaction(new_tx)
print(prediction.to_dict())
```
**Important:** Make sure to feed transactions **in chronological order per customer** so that the lag/velocity feature states are accurately maintained!

### Method C: Quick CLI Smoke Test

You can test arbitrary JSON transactions directly from your terminal using `fraud_pipeline.py`.

```bash
python scripts/fraud_pipeline.py --artifacts-dir models --transaction-json \
  '{"TRANSACTION_ID":1,"CUSTOMER_ID":42,"TERMINAL_ID":917,"TX_DATETIME":"2026-07-05 02:14:00","TX_AMOUNT":189.5}'
```

---

## ⚙️ Maintenance & Retraining

### 1. Training from Scratch
Run the training script to generate fresh models and feature engineered state from your raw CSV data.

```bash
uv run scripts/train_and_save_models.py
```
*Outputs saved to `models/`: `feature_engineer.pkl`, `fraud_detector.joblib`, `scenario_detector.joblib`, `fraud_threshold.joblib`.*

### 2. Daily Batch Refresh
To ensure the model has up-to-date historical risk metrics (like terminal fraud rates), run a daily batch job after yesterday's fraud investigations are complete:

```python
# Assuming newly_labeled_tx_df contains yesterday's confirmed transactions
pipeline.refresh_daily_risk_stats(newly_labeled_tx_df)   # Refreshes lookups
pipeline.save_state("models")                             # Persists realtime lag states
```

---

## 📁 File Structure Reference

| File / Module | Description |
|---|---|
| **`scripts/feature_engineering.py`** | `FraudFeatureEngineer` — Handles computation of all 25 features. Features batch (`fit`) and stateful online modes (`transform`). |
| **`scripts/models.py`** | `FraudModelBundle` — Wrapper handling binary fraud prediction, multiclass scenario prediction, and SHAP explainability. |
| **`scripts/fraud_pipeline.py`** | `FraudDetectionPipeline` — The primary entry point orchestrating feature engineering and model prediction seamlessly. |
| **`inference.py`** | Hands-on test script showcasing inference across normal transactions and all 3 fraud scenarios. |
| **`scripts/train_and_save_models.py`** | Batch training script to execute feature engineering, train models, and serialize artifacts to disk. |
