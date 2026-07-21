# 🛡️ Real-Time Fraud Transaction System

Welcome to the production-ready inference pipeline for our Fraud Detection project! This repository contains the object-oriented, reusable machinery required to take raw transactions, engineer features on the fly, and run them through our trained models to predict and categorize fraudulent activity.

This documentation is tailored to help developer teammates understand the architecture, get the models running locally, and effectively perform inference.

---

## ⚡ Quick Start: Running Backend & UI

Follow these simple steps to start the **FastAPI Backend** and the **React Admin/Customer UI**.

### 1. 🐍 Start the Backend Server (FastAPI)
Open a terminal in the root directory and run:
```bash
# Install dependencies & sync environment
uv sync

# Run the backend API server on port 8005
uv run uvicorn backend.main:app --reload --port 8005
```
* **API Server**: `http://localhost:8005`
* **Swagger API Docs**: `http://localhost:8005/docs`

---

### 2. 🎨 Start the Frontend UI (React + Vite)
Open a second terminal, navigate to the `frontend` folder, and start the development server:
```bash
cd frontend

# Install node dependencies
bun install   # or npm install

# Start frontend dev server
bun run dev   # or npm run dev
```
* **Frontend Web App**: `http://localhost:8081` (or `http://localhost:3000`)

---

### 3. 🔐 Access Portals & Login Credentials

#### 📊 Admin Dashboard (`http://localhost:8081/dashboard`)
* **URL**: `http://localhost:8081/dashboard`
* **Admin Customer ID / Card Number**: `100000` (or `100002`)
* **Password**: `admin123`
* **Role**: `admin`

> **Features Included**:
> * **Live Monitoring** (`/dashboard/live`): Real-time WebSocket stream of payments with SHAP explainability feature impacts.
> * **Analytics** (`/dashboard/analytics`): Model performance, score distribution histogram, and 24h risk clock.
> * **Kafka Event Logs** (`/dashboard/logs`): Real-time JSON log event viewer with log-level filters.
> * **Customer Reports** (`/dashboard/reports`): Customer fraud claims and automated 2FA audit log resolution panel.
> * **Customers Table** (`/dashboard/customers`): Paginated 20-customer per page directory with real profile inspector.
> * **Interactive Chart Help**: `<HelpCircle />` hover tooltips on every chart explaining insights in plain English.

#### 💳 Customer Payment Portal (`http://localhost:8081/pay`)
* **URL**: `http://localhost:8081/pay`
* **Customer ID / Card Number**: `100009` (or `100005`, `100006`)
* **Password**: `password123`
* **Role**: `user`

> **Features Included**:
> * Interactive Google Terminal Map location selector.
> * Automatic HTML5 Geolocation reverse geocoded to real **City, Country** (e.g. `Cairo, Egypt`).
> * Instant risk evaluation and WhatsApp 2FA OTP verification flow.

---

## 🚀 What's New in this Branch?

We have introduced several massive upgrades to the core pipeline:

### 1. 📱 Twilio WhatsApp OTP Verification (Human-in-the-Loop)
To close the loop on real-time fraud mitigation, the pipeline now integrates natively with the **Twilio WhatsApp API**.
* When a transaction is flagged as fraud, the pipeline instantly generates a secure 6-digit OTP.
* A customized alert is sent via WhatsApp to the user's registered phone number.
* The pipeline remembers the OTP internally (`pipeline._pending_otps`). You can then securely verify the user's input by calling `pipeline.confirm_transaction_otp()`.

### 2. 🎨 Dual-Logging System (Terminal + JSON)
We implemented a robust dual-logger (`scripts/logger.py`):
* **For Developers (Terminal):** Uses `rich` to print beautiful, color-coded tags (`[ FRAUD FLAGGED ]`, `[ PENDING ]`, `[ OTP VERIFIED ]`) and formatting directly to your console.
* **For Dashboards & LLMs (JSON):** Silently saves every event as a structured JSON object into `logs/fraud_events.log`. This file contains the exact `extra={...}` payload (including transaction IDs and probabilities) making it perfectly machine-readable for Ali's Dashboard and Hagar's LLM Reports.

### 3. 🔍 Real-Time SHAP Explainability
The pipeline now supports **TreeSHAP Explainability** via `explainability.py`. When scoring a transaction with `explain=True`, it returns the exact feature contributions that led to the fraud decision.

---

## 1. Where this fits in the architecture

```text
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
                                        Dashboard + JSON Logs
                                                 │
                                    ┌────────────┴────────────┐
                                    ▼                         ▼
                              Send OTP (Twilio)        LLM/RAG report
                              Pending/Confirm loop     for System Admin
```

---

## 2. Prerequisites & Installation

We use **[uv](https://docs.astral.sh/uv/)** for dependency management.

```bash
# 1. Clone the repo, then from the project root:
uv sync

# 2. Install the new logging libraries (if not already synced):
uv add rich python-json-logger

# 3. Setup Twilio Credentials
# Create a `.env` file in the root directory and add your Twilio keys:
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

> [!WARNING]
> **Is the script taking 2+ minutes to load?**
> If `models/feature_engineer.pkl` fails to load due to mismatched `scikit-learn` or `pandas` versions, the pipeline will silently rebuild the feature engineer from the 30MB CSV files, which takes minutes. 
> **Fix it instantly** by running `uv run python scripts/train_and_save_models.py` to generate a fresh pickle file for your exact machine!

---

## 3.5 Real-Time Kafka Streaming Simulation

We have built a production-grade, asynchronous **Kafka stream processing simulation** that operates directly inside Python (without requiring any external Docker, JVM, or ZooKeeper setups). This makes it ideal for running in Visual Studio Code or Google Colab out of the box.

To run the full concurrent Producer + Consumer streaming pipeline:
```bash
# Recommended command to run the interactive simulation:
uv run python run_kafka_pipeline.py --speed 0.5 --max-tx 100 --explain --interactive
```

### Advanced Production Simulation Features:
1. **JSON SerDe (Byte Serialization):** The producer converts dictionaries into raw UTF-8 JSON bytes and publishes them to the in-memory topic. The consumer deserializes the bytes back into Python objects, replicating wire-level transmission.
2. **Dead Letter Queue (DLQ):** If a corrupted or malformed message enters the stream (e.g. missing `CUSTOMER_ID`), the consumer catches the exception and routes the transaction payload to the `fraud-dlq` topic instead of crashing the service.
3. **Live Metrics Dashboard:** The consumer prints a real-time `rich` formatted stats panel displaying:
   * **Approved**: Total transactions successfully approved (either automatically clean or confirmed by correct OTP).
   * **Blocked (Declined)**: Transactions permanently blocked because the OTP verification failed or timed out.
   * **Compromised Terminals**: Total unique terminals currently blacklisted.
   * **Fraud Flagged (OTP Sent)**: Total number of OTPs triggered.
   * **User Approved (OTP)**: Number of fraud cases approved by correct OTP inputs.
4. **Interactive vs. Automated OTPs:** If a transaction is flagged as fraud:
   * By default, it runs in **automated mode** where a mock user inputs the WhatsApp OTP after a fraction of a second (simulating a response).
   * Run with `--interactive` to suspend processing and manually type the OTP into the console to approve or reject the card charge.
5. **Real-Time Customer Feedback Loop & Rule Engine (Scenario 2):**
   * If a transaction is a **False Negative** (ML model missed the fraud and approved it), the pipeline simulates a customer reporting the fraud.
   * On the **very first report**, the terminal is immediately blacklisted (`Compromised Terminals` increments).
   * Any subsequent transaction from that terminal is intercepted by the **Rule Engine Gate**, flagged as `Terminal Skimming` (Scenario 2) with 100% probability, and routed directly to the OTP flow, bypassing the ML model entirely to protect the system.
6. **40-Second OTP Timeout**: In interactive mode, if the user does not enter the OTP within **40 seconds**, the verification window automatically expires, the transaction is marked as blocked, and the stream resumes.
7. **Instant Graceful Shutdown:** Pressing `Ctrl+C` (SIGINT) cleanly aborts the OTP input prompt immediately, shuts down all threads safely, and displays the **Final Stream Metrics Report** instantly.

---

## 4. API Integration Guide

If you are wiring this pipeline into a FastAPI endpoint or Kafka consumer, here is how you use the new `FraudDetectionPipeline`.

### Loading it (once, at process startup)

```python
from scripts.fraud_pipeline import FraudDetectionPipeline

pipeline = FraudDetectionPipeline.from_artifacts(
    "models", 
    load_explainer=True,
    send_whatsapp_alerts=True  # Automatically triggers Twilio on fraud
)
```

### Scoring and OTP Verification

```python
new_tx = {
    "TRANSACTION_ID": 900001,
    "CUSTOMER_ID": 42,
    "TERMINAL_ID": 917,
    "TX_DATETIME": "2026-07-05 02:14:00",
    "TX_AMOUNT": 110.50,
    "PHONE_NUMBER": "+201093836155" # Required for WhatsApp alerts
}

# 1. Process the transaction and get SHAP explanations
prediction, explanation = pipeline.process_transaction(new_tx, update_state=True, explain=True)

if prediction.is_fraud:
    # 2. An OTP was automatically sent! The transaction is now conceptually "Pending".
    print(f"Transaction {prediction.transaction_id} flagged. OTP sent.")
    
    # 3. Later, when the user submits the OTP via your API endpoint:
    user_submitted_otp = "123456"
    is_valid = pipeline.confirm_transaction_otp(prediction.transaction_id, user_submitted_otp)
    
    if is_valid:
        print("OTP Confirmed! Transaction Approved.")
        prediction.is_fraud = False
```

---

## 5. File Structure Reference

| Module | Description |
|---|---|
| **`run_kafka_pipeline.py`** | **[NEW]** Asynchronous Kafka simulation runner with metrics, SerDe, and DLQ handling. |
| **`inference.py`** | **[NEW]** Interactive CLI script to test scoring, SHAP, and Twilio OTPs. |
| **`scripts/fraud_pipeline.py`** | `FraudDetectionPipeline` — The main real-time scoring API wrapper. |
| **`scripts/kafka_simulation.py`** | **[NEW]** In-memory thread-safe queues simulating Kafka broker, producer, and consumer APIs. |
| **`scripts/twilio_notifier.py`** | **[NEW]** `WhatsAppNotifier` — Handles secure Twilio communication. |
| **`scripts/logger.py`** | **[NEW]** Dual-logger outputting `rich` terminal colors and structured JSON. |
| **`scripts/explainability.py`** | `FraudModelExplainer` — Computes SHAP and feature importance. |
| **`scripts/feature_engineering.py`** | Handles realtime lag/velocity features (stateful). |
| **`scripts/models.py`** | Wraps the binary LightGBM model and the multiclass scenario model. |
| **`scripts/batch_predictor.py`** | Bulk scoring path for DataFrames/CSVs. |
| **`scripts/train_and_save_models.py`** | Run this to regenerate the `.pkl` and `.joblib` model artifacts. |

---

# FraudShield — How to Run

## 1. Setup Database

### PostgreSQL (Docker)
Run PostgreSQL in a dedicated Docker container, isolated from any other Postgres instance on the machine (mapped to host port **5433**). Full details, verification steps, and the Docker commands reference are in [`POSTGRESQL.md`](./POSTGRESQL.md).

```powershell
docker run -d `
  --name fraud-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=fraud_db `
  -p 5433:5432 `
  postgres:17
```

Verify it's running:
```bash
docker ps
```

### Update .env
Edit `.env` in the project root and point `DATABASE_URL` at the Dockerized instance (port **5433**, matching the container mapping above):
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fraud_db
```

---

## 2. Install Dependencies

```bash
uv sync
```

---

## 3. Seed the Terminals

Loads terminal lat/lon from the trained feature engineer (or generates 100 mock Cairo terminals):

```bash
uv run python -m backend.db.seed
```

---

## 4. Start the Backend API

```bash
uv run uvicorn backend.main:app --reload --port 8005
```

The API will:
- Apply the database schema automatically
- Load the ML pipeline (may take ~30s if rebuilding feature engineer)
- Expose: http://localhost:8005/docs (Swagger UI)

---

## 5. Seed Terminals (Optional Shortcut)

If you want to seed terminal locations after the server is up:

```bash
uv run python -m backend.db.seed
```

---

## 6. Creating Additional Admin Users

By default, an Admin account is provisioned:
* **Admin Customer ID / Card Number**: `100000` (or `100002`)
* **Password**: `admin123`

To promote any registered customer (`role = 'user'`) to `admin` in PostgreSQL:

```bash
docker exec -it fraud-postgres psql -U postgres -d fraud_db
```

Then execute:

```sql
UPDATE customers
SET role = 'admin'
WHERE customer_id = <CUSTOMER_ID>;
```

Verify it:

```sql
SELECT customer_id, phone_number, role FROM customers WHERE role = 'admin';
```

Exit PostgreSQL:

```sql
\q
```

---

## Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Docker container on port 5433 — see [`POSTGRESQL.md`](./POSTGRESQL.md)) |
| `REDIS_URL` | Redis connection string (default: `redis://localhost:6379`) |
| `JWT_SECRET` | Secret key for JWT tokens — change in production! |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp Sandbox number |

---

*For detailed batch prediction or warm-start instructions, refer to the inline documentation inside `fraud_pipeline.py` and `batch_predictor.py`.*