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
from scripts.logger import get_logger

logger = get_logger("inference")

def test_scenarios():
    logger.info(f"[bold cyan]Loading feature engineering, models, and threshold from:[/bold cyan] {MODELS_DIR}...")
    pipeline = FraudDetectionPipeline.from_artifacts(
        MODELS_DIR, 
        load_explainer=True,
        send_whatsapp_alerts=True
    )
    
    logger.info(f"Loading sample transactions from {DATA_DIR}/synthetic_fraud_transactions.csv...")
    try:
        df = pd.read_csv(DATA_DIR / "synthetic_fraud_transactions.csv")
    except FileNotFoundError:
        logger.error("Could not find the dataset. Make sure you have the synthetic data generated.")
        return

    # Extract exactly one transaction for each scenario from the actual dataset
    test_cases = {
        "1. NORMAL (Non-Fraud)": df[df["TX_FRAUD"] == 0].iloc[10].to_dict(),
        "2. SCENARIO 1 (Large Amount)": df[df["TX_FRAUD_SCENARIO"] == 1].iloc[19].to_dict(),
        "3. SCENARIO 2 (Terminal Skimming)": df[df["TX_FRAUD_SCENARIO"] == 2].iloc[8200].to_dict(),
        "4. SCENARIO 3 (Credential Takeover)": df[df["TX_FRAUD_SCENARIO"] == 3].iloc[10].to_dict(),
    }
    
    for case_name, tx in test_cases.items():
        logger.info(f"\n[bold magenta]{'='*50}[/bold magenta]")
        logger.info(f"[bold magenta]Testing Case: {case_name}[/bold magenta]")
        logger.info(f"[bold magenta]{'='*50}[/bold magenta]")
        
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
        
        logger.info("Incoming Raw Transaction:")
        print(json.dumps(raw_tx, indent=2))
        
        # Process the transaction
        # The new pipeline returns a tuple if explain=True: (FraudPrediction, dict_of_shap_values)
        prediction, explanation = pipeline.process_transaction(raw_tx, update_state=False, explain=True)
        
        logger.info("\n[bold cyan]Prediction Result:[/bold cyan]")
        print(json.dumps(prediction.to_dict(), indent=2))

        if explanation and prediction.is_fraud:
            logger.info("\n[bold cyan]TreeSHAP Explanation:[/bold cyan] (Top features driving this fraud score)")
            for k, v in sorted(explanation.items(), key=lambda item: abs(item[1]), reverse=True)[:5]:
                print(f"  {k}: {v:.4f}")

        # Simulate the pending state if an OTP was sent
        if prediction.is_fraud and raw_tx["TRANSACTION_ID"] in pipeline._pending_otps:
            # We fetch the generated OTP from memory just to show it for local testing
            expected_otp = pipeline._pending_otps[raw_tx["TRANSACTION_ID"]]
            logger.info(f"\n[bold yellow]🔒 [DEV LOG] OTP Generated & Sent to Twilio:[/bold yellow] [white]{expected_otp}[/white]")
            logger.info(f"[bold orange3]⏳ [PENDING][/bold orange3] Transaction {raw_tx['TRANSACTION_ID']} suspended. Waiting for user to enter OTP...")
            
            user_input = input("Enter OTP from WhatsApp to approve transaction (or press Enter to fail): ")
            
            # The pipeline provides an API to confirm it safely
            if pipeline.confirm_transaction_otp(raw_tx["TRANSACTION_ID"], user_input.strip()):
                prediction.is_fraud = False # overriding since it was confirmed by user
            else:
                logger.error("[bold red]Transaction permanently blocked.[/bold red]")

if __name__ == "__main__":
    test_scenarios()
