# Real-Time Fraud Transaction Detection System

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Jupyter Notebook](https://img.shields.io/badge/jupyter-%23FA0F00.svg?style=flat&logo=jupyter&logoColor=white)](https://jupyter.org/)
[![Machine Learning](https://img.shields.io/badge/scikit--learn-%23F7931E.svg?style=flat&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Data Processing](https://img.shields.io/badge/pandas-%23150458.svg?style=flat&logo=pandas&logoColor=white)](https://pandas.pydata.org/)

An end-to-end framework for analyzing, engineering features for, and detecting credit card transactions fraud. Using a dataset consisting of customer profiles, terminal coordinate profiles, and a stream of over **1.75 million synthetic transactions**, this project models and identifies distinct fraudulent behavioral profiles targeting different gaps in real-time automated banking security systems.

---

## 📌 Table of Contents
1. [Project Overview & Objectives](#-project-overview--objectives)
2. [Dataset Architecture](#-dataset-architecture)
3. [Exploratory Data Analysis (EDA) Insights](#-exploratory-data-analysis-eda-insights)
4. [Detailed Fraud Scenario Profiles](#-detailed-fraud-scenario-profiles)
5. [Feature Engineering Recommendations](#-feature-engineering-recommendations)
6. [Baseline Modeling & Performance](#-baseline-modeling--performance)
7. [Advanced Mitigation Strategies](#-advanced-mitigation-strategies)
8. [Project Structure](#-project-structure)
9. [Installation & Usage](#-installation--usage)

---

## 🔍 Project Overview & Objectives

In the financial industry, detecting fraudulent transactions in real-time is challenging due to:
* **Extreme Class Imbalance:** Fraudulent transactions typically make up less than 1% of total transaction volumes.
* **Adversarial Adaptability:** Fraudsters continuously change patterns to bypass simple threshold-based block rules.

The objective of this project is to:
1. Conduct deep **Exploratory Data Analysis (EDA)** to dissect different fraud behaviors.
2. Characterize the operational "fingerprints" of **three distinct fraud scenarios** vs. legitimate customer habits.
3. Design **specialized feature engineering strategies** targeting each scenario.
4. Establish a baseline machine learning classifier to identify bottlenecks and chart the path toward a high-recall real-time fraud mitigation model.

---

## 📊 Dataset Architecture

The analysis merges three primary datasets located in the `full dataset with brief/` directory:

| Dataset File | Records | Key Columns | Description |
| :--- | :--- | :--- | :--- |
| **`customer_profiles.csv`** | 5,000 | `CUSTOMER_ID`, `x_customer_id`, `y_customer_id`, `mean_amount`, `std_amount`, `mean_nb_tx_per_day` | Historical spending means, standard deviations, transaction frequencies, and location coordinates for customers. |
| **`terminal_profiles.csv`** | 10,000 | `TERMINAL_ID`, `x_terminal_id`, `y_terminal_id` | Geospatial coordinate profiles for credit card merchant terminals. |
| **`synthetic_fraud_transactions.csv`** | 1,754,155 | `TRANSACTION_ID`, `TX_DATETIME`, `CUSTOMER_ID`, `TERMINAL_ID`, `TX_AMOUNT`, `TX_FRAUD`, `TX_FRAUD_SCENARIO` | A stream of transactions simulated over a **180-day period**, labeled with target markers and fraud scenario indicators. |

---

## 📈 Exploratory Data Analysis (EDA) Insights

From [notebook.ipynb](file:///media/ahmed-fayad/3b40def2-87b7-41ce-8913-2981f887941c/home/Graduation%20Project%20inshallah/notebook.ipynb), the key exploratory findings include:
* **Geospatial Proximity:** Legitimate transactions typically occur close to a customer's registered coordinates. Distances are calculated using the Euclidean distance between `(x_customer_id, y_customer_id)` and `(x_terminal_id, y_terminal_id)`.
* **Transaction Amount Distribution:** Non-fraudulent transactions follow a customer-specific normal distribution. Fraudulent transactions show extreme deviation, scaling dramatically higher (except for terminal-based stealth fraud).
* **Temporal Patterns:** There is no seasonal/monthly pattern over the 180-day simulation. However, a strong diurnal (hourly) pattern exists—legitimate transactions drop sharply in the early morning hours, while certain automated fraud types operate round-the-clock.
* **Class Distribution Imbalance:** In a typical 10% sample of the data (35,084 records):
  * **Legitimate Class (0):** 34,795 transactions (99.18%)
  * **Fraudulent Class (1):** 289 transactions (0.82%)

---

## 🔍 Detailed Fraud Scenario Profiles

An analysis of transaction behavior across three distinct simulated fraud scenarios vs. the baseline legitimate behavior ([senario.ipynb](file:///media/ahmed-fayad/3b40def2-87b7-41ce-8913-2981f887941c/home/Graduation%20Project%20inshallah/senario.ipynb)) reveals their profiles:

### 🟢 Scenario 0: Legitimate Baseline (Normal Behavior)
* **Transaction Amount:** Consistently low and tightly bound, primarily remaining under **$100**.
* **Spending Deviation:** Sits cleanly at a **1.0 spending ratio** ($Actual / Mean$), indicating customers spend exactly what their historical metrics predict.
* **Timeline Distribution:** Shows a stable, high-frequency density across the entire 180-day simulation timeframe.
* **Operational Signature:** Standard, predictable consumer purchasing patterns.

### 🔵 Scenario 1: The "Fixed-Threshold" Programmatic Fraud
* **Transaction Amount:** Displays an incredibly rigid, narrow distribution tightly bound right around **$250** with virtually zero variance.
* **Spending Deviation:** The spending ratio scales predictably relative to the victim's card history, showing up as a distinct, flat band on deviation charts.
* **Timeline Distribution:** Occurs at a very low but persistent frequency (1 to 11 incidents daily) throughout the entire timeline.
* **Operational Signature:** Mimics **automated card-testing or programmatic exploits** targeting a specific financial threshold known to bypass automated instant-block rules.

### 🟡 Scenario 2: The "Low-Profile/Stealth" Merchant Fraud
* **Transaction Amount:** Completely identical to normal behavior, with amounts usually falling well below **$100**.
* **Spending Deviation:** Maintains a perfect **1.0 spending ratio**, making it completely indistinguishable from legitimate behavior at an individual transaction level.
* **Timeline Distribution:** Starts at zero on Day 0 and steadily ramps up over a 25-day period before flattening into a high-volume plateau (~40–60 incidents per day).
* **Operational Signature:** Classic **compromised terminal or rogue merchant fraud**. Because individual transactions appear safe, detection relies entirely on identifying point-of-sale volume anomalies or aggregated terminal risk patterns over time.

### 🔴 Scenario 3: The "Whale/Account-Draining" Identity Theft
* **Transaction Amount:** Volatile and massive. While the bulk sits between $100 and $500, it features a heavy tail of extreme outliers reaching up to **$2,500+**.
* **Spending Deviation:** Fully detaches from historical profiles, averaging **5x to 10x higher** than the victim’s typical `mean_amount`.
* **Timeline Distribution:** Features an initial 20-day ramp-up phase before stabilizing into a steady frequency of 20–35 daily occurrences.
* **Operational Signature:** Represents aggressive **identity theft or card-cloning**. The fraudster ignores normal spending patterns, prioritizing maximizing immediate cash-out value before the account is permanently locked by the cardholder.

---

## 🛠️ Feature Engineering Recommendations

To effectively catch these anomalies, the following specialized features should be engineered and integrated into the classification pipeline:

| Scenario | Target Indicator | Feature Engineering Strategy |
| :--- | :--- | :--- |
| **Scenario 1** | Rigid transaction values | Binned boolean flags targeting specific absolute values (e.g., `is_near_250_usd` where $|TX\_AMOUNT - 250| < \epsilon$). |
| **Scenario 2** | Terminal-based volume shifts over time | Rolling terminal risk windows (e.g., `terminal_fraud_rate_7d`, `terminal_velocity_30d` count). |
| **Scenario 3** | Severe profile deviation | Behavioral ratio metrics (e.g., `TX_AMOUNT / mean_amount` and `TX_AMOUNT / std_amount`). |
| **Geospatial** | Location anomalies | Euclidean customer-to-terminal distance `cust_term_dist` = $\sqrt{(x_{cust} - x_{term})^2 + (y_{cust} - y_{term})^2}$. |
| **Temporal** | Diurnal cycle anomalies | Extracted datetime features: `tx_hour`, `tx_dow` (day of week), `tx_seconds` (seconds since midnight), `tx_daynum` (offset from simulation start). |

---

## 🤖 Baseline Modeling & Performance

A baseline machine learning model was trained using `scikit-learn` in [Modeling_notebook.ipynb](file:///media/ahmed-fayad/3b40def2-87b7-41ce-8913-2981f887941c/home/Graduation%20Project%20inshallah/Modeling_notebook.ipynb) on a 10% stratified sample of the dataset.

### Pipeline Configuration
1. **Preprocessing:** `SimpleImputer(strategy='median')` followed by `StandardScaler()`.
2. **Classifier:** `RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)`.
3. **Features Used:** `TX_AMOUNT`, `tx_hour`, `tx_dow`, `tx_seconds`, `tx_daynum`, `cust_term_dist`, `mean_amount`, `std_amount`, `mean_nb_tx_per_day`, `nb_terminals`, `term_count`.

### Evaluation Metrics (Baseline Results)
The classifier achieved an overall accuracy of **99.18%**, but this metric is highly misleading due to the severe class imbalance:

```text
              precision    recall  f1-score   support

           0     0.9918    1.0000    0.9959     34795
           1     0.0000    0.0000    0.0000       289

    accuracy                         0.9918     35084
   macro avg     0.4959    0.5000    0.4979     35084
weighted avg     0.9836    0.9918    0.9877     35084

ROC AUC: 0.5838
```

#### Confusion Matrix
```text
[[34795     0]
 [  289     0]]
```

### Analysis of Failure Mode
The baseline model predicted **0 fraudulent transactions** (100% false negatives for the fraud class). Because the majority class (legitimate) is 99.18% of the data, the classifier minimizes cross-entropy loss by predicting the majority class exclusively. The ROC AUC of **0.5838** shows the model has very poor discriminative power with the raw baseline features.

---

## 🛠️ Advanced Mitigation Strategies

To transform the baseline pipeline into a viable detection system, the following implementations are highly recommended:

1. **Threshold Moving (Probability Calibration):**
   * Do not use the default `0.5` decision threshold. In fraud detection, a threshold of `0.01` to `0.05` is typical to capture high recall, even if precision decreases slightly.
2. **Class Weight Adjustment:**
   * Configure the model using `class_weight='balanced'` or `class_weight='balanced_subsample'` inside the RandomForest classifier.
3. **Resampling Techniques:**
   * Apply SMOTE (Synthetic Minority Over-sampling Technique) or hybrid SMOTE + Tomek links during the training phase (using the `imbalanced-learn` library) to balance class distributions.
4. **Gradient Boosting Models:**
   * Transition from Random Forests to **XGBoost** or **LightGBM**, which natively support scale parameter weights (`scale_pos_weight`) to penalize minority misclassifications heavily.

---

## 📂 Project Structure

```bash
├── full dataset with brief/          # Raw data directory
│   ├── customer_profiles.csv         # Customer spending histories
│   ├── terminal_profiles.csv         # Terminal coordinates
│   └── synthetic_fraud_transactions.csv  # 1.75M Transaction logs
├── notebook.ipynb                    # Main Exploratory Data Analysis (EDA)
├── senario.ipynb                     # Detailed profile analysis of scenarios 1, 2, 3
├── Modeling_notebook.ipynb            # Baseline preprocessing and model training
├── Data_Questions.pdf                # Reference project guidance questions
├── .env                              # Environment configuration
└── README.md                         # Project documentation (this file)
```

---

## 🚀 Installation & Usage

### 1. Prerequisites
Ensure you have Python 3.8+ and pip installed.

### 2. Set Up a Virtual Environment
```bash
# Create environment
python3 -m venv venv

# Activate environment
source venv/bin/activate
```

### 3. Install Dependencies
Create a `requirements.txt` file or install directly:
```bash
pip install pandas numpy scikit-learn matplotlib seaborn jupyter
```

### 4. Running the Notebooks
To run the notebooks and inspect the EDA plots:
```bash
jupyter notebook
```
Navigate to and open:
* `notebook.ipynb` for the general EDA.
* `senario.ipynb` to view the fraud scenario profiles and boxplots.
* `Modeling_notebook.ipynb` to run the baseline model.
