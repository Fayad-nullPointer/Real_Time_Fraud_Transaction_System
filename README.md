# Real-Time Fraud Transaction System (VanGuard Shield)

VanGuard Shield is an end-to-end, high-performance, real-time transaction monitoring and fraud mitigation system. Designed for both financial stakeholders and technical operations teams, the platform ingests streaming transactions, computes stateful behavioral features, scores risk using calibrated machine learning models under sub-millisecond latencies, and triggers automated, human-in-the-loop multi-factor authentication (MFA).

---

## Executive Summary

Credit card fraud costs the financial sector billions annually. Traditional batch processing systems flag suspicious activity hours or days after it occurs, causing significant losses. VanGuard Shield solves this problem by evaluating risk on-the-fly inside the active payment authorization path. 

The core value proposition of the system rests on three pillars:
* **Immediate Risk Mitigation**: Transactions are scored, and high-risk operations are suspended or blocked before funds leave the account.
* **Low False-Positive Rates**: Probability calibration ensures that operational investigators are not overwhelmed by false alerts, maintaining customer trust.
* **Human-in-the-Loop Verification**: Flagged anomalies trigger an automated WhatsApp One-Time Password (OTP) request, resolving potential fraud in real time without human analyst intervention.

---

## System Architecture

The platform uses a hybrid gateway and asynchronous processor model to ensure maximum throughput, low response times, and deep sequence analysis.

```
Incoming Transaction
        │
        ▼
Stateful Feature Engineering Layer (In-Memory Latency: < 1ms)
        ├── Dynamic coordinate calculations
        ├── Rolling terminal fraud rates (3d, 7d, 28d)
        └── Customer transaction velocity
        │
        ▼
Real-Time Gateway (LightGBM Binary Classifier)
        ├── Risk Probability Score <= Threshold (Approved)
        └── Risk Probability Score > Threshold (Flagged)
                    │
                    ├──► Trigger TreeSHAP Explainer (Explainability Engine)
                    ├──► Save structured JSON logs to events DB
                    └──► Initiate Twilio WhatsApp OTP MFA Flow
                             │
                             ▼
                    [MFA Verification Loop]
                             ├── Correct OTP / User Confirms (Approved)
                             └── Incorrect OTP / 40s Timeout (Blocked & Blacklisted)
```

### Hybrid Execution Strategy
To achieve both sub-millisecond response times and comprehensive behavioral context, the modeling pipeline is divided into two layers:
1. **Real-Time Gateway (LightGBM)**: Processes inline transaction authorization requests under 1 millisecond. It uses localized features such as transaction amount Z-scores, rolling terminal risk, and spatial coordinate shifts.
2. **Asynchronous Sequence Engine (PyTorch LSTM)**: Evaluates a 15-step customer sequence history in the background. It models long-term behavioral changes and flags slow-rolling account takeovers (Credential Takeovers) that bypass single-transaction threshold gates.

### In-Memory Kafka Streaming Simulation
The backend includes a production-grade, asynchronous message streaming simulation.
* **UTF-8 JSON Serialization/Deserialization (SerDe)**: Replicates wire-level data transfer between producer and consumer threads.
* **Dead Letter Queue (DLQ)**: Automatically intercepts malformed or corrupted transactions (e.g., missing critical keys) and routes them to a `fraud-dlq` queue to prevent pipeline blockages.

### Geographic Rule Engine
If a customer reports a bypassed fraud event, a secondary safety layer is activated:
* The transaction is flagged, and the associated physical terminal is instantly blacklisted.
* A spatial rule interceptor bypasses the machine learning model for any future transactions at that terminal, routing them directly to the 2FA flow to isolate skimming operations immediately.

---

## Stateful Feature Engineering

Raw transaction fields (amount, location, and timestamp) do not contain enough signal for high-accuracy predictions. VanGuard Shield engineers 25 stateful features in real time. The main techniques include:

### 1. Spatial Distance Calculation
Calculates the Euclidean distance between the current transaction coordinates and the customer's last known terminal coordinates. If a physical transaction occurs in Cairo and another occurs in Alexandria 10 minutes later, the spatial speed anomaly is flagged.

### 2. Spatial Neighborhood Risk Density (KDTree)
Using SciPy's KDTree, the system clusters terminals within a 1.0 unit coordinate radius. It projects historical terminal fraud rates onto the spatial neighborhood matrix. This allows the system to estimate risk zones and predict skimming hotspots before a specific terminal records its first official fraud alert.

### 3. Multi-Scale Rolling Terminal Fraud Rates
Terminal fraud rates are calculated over 3-day, 7-day, and 28-day windows. These windows are shifted by 1 day to prevent target leakage during model training. This temporal aggregation quickly catches terminals compromised by physical skimming devices.

### 4. Multi-Step Customer Sequence Lags
To bypass attackers who interleave normal, small payments between large fraudulent charges, the feature engineering pipeline tracks customer spending history over multiple steps:
* Lags 1, 2, and 3 record the transaction amounts of the previous 3 operations.
* Deviation ratios (e.g., `ratio_to_lag2`, `ratio_to_lag3`) prevent simple interleaved transactions from resetting the model's sequence memory.

---

## Machine Learning Modeling & Results

The system evaluates four model configurations on a chronological test dataset consisting of 412,221 transactions (Days 140 to 182). This ensures evaluation aligns with realistic deployment conditions.

### Model Performance Comparison

| Model | AUC-ROC | AUC-PR | Average Daily Precision@100 | Average Daily Card Precision@100 | Train Time (Seconds) |
|---|---|---|---|---|---|
| Baseline (Raw Features) | 0.6475 | 0.2543 | 21.47% | 17.23% | 1.52 |
| **LightGBM (Engineered)** | **0.9745** | **0.9183** | **77.49%** | **69.93%** | **1.66** |
| CatBoost (Categorical IDs) | 0.9728 | 0.8979 | 76.40% | 68.86% | 17.87 |
| PyTorch LSTM (Sequence) | 0.9675 | 0.7985 | 69.44% | 62.60% | 108.21 |

### Scenario-Specific Recall (Capture Rate at Top 1% Daily Alerts)

Transactions are sorted by predicted probability daily, and the top 1% most suspicious transactions are flagged for review. The capture rates across the three fraud scenarios are detailed below:

| Model | Scenario 1 Recall (Amount > $220) | Scenario 2 Recall (Skimming) | Scenario 3 Recall (Credential Takeover) |
|---|---|---|---|
| Baseline (Raw Decision Tree) | 100.00% | 1.12% | 62.25% |
| **LightGBM (Engineered)** | **100.00%** | **90.60%** | **89.18%** |
| CatBoost (Categorical IDs) | 100.00% | 89.70% | 87.30% |
| PyTorch LSTM (Sequence) | 14.60% | 84.37% | 82.56% |

* **Scenario 1 (Large Amount)**: Outlier transaction amounts compared to typical customer history.
* **Scenario 2 (Terminal Skimming)**: Cards swiped at physical terminals that show a high rolling fraud density.
* **Scenario 3 (Credential Takeover)**: Sudden, high-velocity transactions combined with geographic shifts and nighttime execution.

### Key Data Science Insights
* **Why LightGBM?**: LightGBM provides the best balance of speed and precision. It trains in less than 2 seconds, achieves the highest PR-AUC (0.9183), and performs inference in sub-milliseconds, satisfying real-time gateway constraints.
* **Probability Calibration**: Traditional imbalanced learning uses artificial class weighting (e.g., `scale_pos_weight=120`), which exaggerates risk scores. VanGuard Shield trains on the true distribution (weight = 1). This ensures that a predicted score of 0.85 corresponds to an actual 85% probability of fraud. Calibrated probabilities place the highest-risk events at the very top of daily review sheets, increasing operational precision from 12% to 77.49% and reducing investigator fatigue.

---

## User Interface Portals

The application features a responsive React and Vite frontend with dedicated interfaces for administrators and customers.

### 1. Admin Security Dashboard
* **Live WebSocket Feed**: Displays real-time transactions with visual status changes (Approved, OTP Pending, Verified, Declined).
* **TreeSHAP Explainability Visuals**: Interactive bars showing the exact features driving a transaction's fraud score.
* **Analytics Center**: Visual charts for model metrics, score distributions, and operational timelines.
* **Terminal Management**: Interactive map showing geographic coordinate clusters of blacklisted terminals.
* **Customer Reports & Ticket Panel**: Displays customer fraud reports and provides manual 2FA override tools.

### 2. Customer Payment Portal
* **Transaction Simulator**: Allows testing of user coordinates, terminal selection, and transaction amounts.
* **HTML5 Location & Reverse Geocoding**: Automatically determines the terminal's city and country.
* **MFA Verification Panel**: Simulates Twilio WhatsApp OTP requests and inputs to authorize pending payments.

---

## Crucial Dashboards & Visualizations

The following visualizations are critical for technical monitoring and stakeholder operations.

### 1. Live Transaction Feed and SHAP Explainability
```
[Placeholder: Live Transaction Feed and TreeSHAP Interactive Panel]
Path: assets/images/live_monitoring.png
```
* **Description**: A streaming feed showing incoming transactions. Selecting a transaction opens a detailed panel displaying a horizontal bar chart of TreeSHAP values. Blue bars show features reducing the risk score (e.g., historical customer presence at the terminal), and red bars show features increasing the risk score (e.g., a high transaction amount or nighttime execution).
* **Why it is Important**: Security analysts need more than a binary classification score. TreeSHAP explainability provides the reasoning behind the model's score, allowing rapid manual review and auditable decisions.

### 2. Fraud Probability Distribution Histogram
```
[Placeholder: Fraud Probability Distribution Histogram Chart]
Path: assets/images/score_distribution.png
```
* **Description**: A column chart grouping transactions by their risk scores from 0.0 (Safe) to 1.0 (Fraud). 
* **Why it is Important**: Helps data scientists verify model calibration. In a calibrated system, the distribution shows a high, narrow bar close to 0.0 for legitimate transactions, and a secondary cluster near 1.0 for true fraud, leaving very few ambiguous transactions in the middle.

### 3. Rolling 24-Hour Fraud Rate and Volume Chart
```
[Placeholder: 24h Rolling Fraud Rate vs. Total Volume Chart]
Path: assets/images/fraud_rate_time.png
```
* **Description**: A dual-axis chart showing total transaction volume (dashed line) against flagged fraud attempts (red line) hourly.
* **Why it is Important**: High-level managers use this to monitor real-time system performance and spot active credit card skimming sprees or system-wide fraud spikes immediately.

### 4. 24-Hour Radial Risk Clock (Fraud Rate by Hour)
```
[Placeholder: 24-Hour Radial Risk Area Chart]
Path: assets/images/hourly_risk_clock.png
```
* **Description**: A circular area chart mapping fraud density across the 24 hours of the day.
* **Why it is Important**: Highlights operational patterns. It shows high risk density during late-night hours (12 AM to 5 AM), helping managers optimize investigator scheduling and configure stricter rules for nighttime authorizations.

### 5. Geolocation Risk Heatmap (Terminal Hotspots)
```
[Placeholder: Terminal Geolocation Risk Zone Map]
Path: assets/images/terminal_map.png
```
* **Description**: An interactive map plotting physical terminals. Terminals are color-coded based on their 3-day and 7-day rolling fraud rates, highlighting geographic clusters of card-skimming operations.
* **Why it is Important**: Allows security operations to identify locations with multiple compromised terminals, enabling coordination with merchants and law enforcement to inspect local hardware.

### 6. Kafka Pipeline Throughput & Dead Letter Queue (DLQ) Traffic
```
[Placeholder: Kafka Stream Throughput and DLQ Monitor]
Path: assets/images/kafka_pipeline.png
```
* **Description**: A line graph plotting message processing rates and consumer lag alongside a bar showing the size of the Dead Letter Queue.
* **Why it is Important**: Critical for technical operations teams. A sudden spike in the Dead Letter Queue indicates API drift or corrupted payload formats, prompting engineers to troubleshoot ingestion schemas before systems fail.

---

## Technical Quick Start & Setup

Follow these steps to run the complete environment locally.

### 1. Database Setup
Run PostgreSQL in an isolated Docker container mapped to host port 5433:
```bash
docker run -d --name fraud-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=fraud_db -p 5433:5432 postgres:17
```

Update your `.env` file in the project root:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/fraud_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### 2. Install Dependencies
The project uses the `uv` package manager for Python and `bun` (or `npm`) for React:
```bash
# Sync Python virtual environment
uv sync

# Add required libraries
uv add rich python-json-logger
```

### 3. Seed Database & Start Backend (FastAPI)
```bash
# Seed terminal coordinates
uv run python -m backend.db.seed

# Start FastAPI API server on port 8005
uv run uvicorn backend.main:app --reload --port 8005
```
* **API Documentation**: http://localhost:8005/docs

### 4. Start Frontend UI (React + Vite)
Open a new terminal window:
```bash
cd frontend
bun install
bun run dev
```
* **Web Portal URL**: http://localhost:8081

### 5. Access Credentials
* **Admin Portal**: Login with ID 100000 (or 100002) and password admin123.
* **Customer Portal**: Login with ID 100009 (or 100005) and password password123.

### 6. Interactive Kafka Pipeline Simulation
To test the full stream processor with automated inputs, serialization, and Dead Letter Queue routing:
```bash
uv run python run_kafka_pipeline.py --speed 0.5 --max-tx 100 --explain --interactive
```
* Press Ctrl+C to gracefully terminate the stream and print the final metrics report.