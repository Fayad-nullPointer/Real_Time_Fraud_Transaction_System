import sys
import json
import pandas as pd
from pathlib import Path

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
MODELS_DIR = PROJECT_ROOT / "models"
DATA_DIR = PROJECT_ROOT / "full dataset with brief"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from scripts.fraud_pipeline import FraudDetectionPipeline

def test_scenarios():
    print(f"Loading feature engineering, models, and threshold from: {MODELS_DIR}...")
    pipeline = FraudDetectionPipeline.from_artifacts(MODELS_DIR)
    
    print(f"Loading sample transactions from {DATA_DIR}/synthetic_fraud_transactions.csv...")
    try:
        df = pd.read_csv(DATA_DIR / "synthetic_fraud_transactions.csv")
    except FileNotFoundError:
        print("Could not find the dataset. Make sure you have the synthetic data generated.")
        return

    # Extract exactly one transaction for each scenario from the actual dataset
    test_cases = {
        "1. NORMAL (Non-Fraud)": df[df["TX_FRAUD"] == 0].iloc[10].to_dict(),
        "2. SCENARIO 1 (Large Amount)": df[df["TX_FRAUD_SCENARIO"] == 1].iloc[19].to_dict(),
        "3. SCENARIO 2 (Terminal Skimming)": df[df["TX_FRAUD_SCENARIO"] == 2].iloc[8200].to_dict(),
        "4. SCENARIO 3 (Credential Takeover)": df[df["TX_FRAUD_SCENARIO"] == 3].iloc[10].to_dict(),
    }
    
    for case_name, tx in test_cases.items():
        print(f"\n{'='*50}")
        print(f"Testing Case: {case_name}")
        print(f"{'='*50}")
        
        # Convert timestamp to string
        tx["TX_DATETIME"] = str(tx["TX_DATETIME"])
        
        # We only pass the raw features to the pipeline, just like a real API
        raw_tx = {
            k: v for k, v in tx.items() 
            if k in ["TRANSACTION_ID", "CUSTOMER_ID", "TERMINAL_ID", "TX_DATETIME", "TX_AMOUNT"]
        }
        
        # --- Inject Dummy Phone Number for Testing Twilio ---
        # Change this dummy number to your VERIFIED Sandbox number to test it!
        raw_tx["PHONE_NUMBER"] = "+201093836155"
        
        print("Incoming Raw Transaction:")
        print(json.dumps(raw_tx, indent=2))
        
        # Process the transaction (runs feature engineering -> fraud model -> scenario model -> TreeSHAP)
        prediction = pipeline.process_transaction(raw_tx, update_state=False)
        
        print("\nPrediction Result:")
        print(json.dumps(prediction.to_dict(), indent=2))

if __name__ == "__main__":
    test_scenarios()
