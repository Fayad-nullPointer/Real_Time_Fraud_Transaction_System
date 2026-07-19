import argparse
import json
import os
import signal
import sys
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from dotenv import load_dotenv

# Setup paths
PROJECT_ROOT = Path(__file__).resolve().parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
MODELS_DIR = PROJECT_ROOT / "models"
DATA_DIR = PROJECT_ROOT / "data"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from scripts.fraud_pipeline import FraudDetectionPipeline
from scripts.kafka_simulation import MockKafkaConsumer, MockKafkaProducer
from scripts.logger import get_logger

# Load environment variables
load_dotenv()

logger = get_logger("kafka_stream_pipeline")

# Thread termination flags
shutdown_event = threading.Event()

# Metrics tracking
class PipelineMetrics:
    def __init__(self):
        self.lock = threading.RLock()
        self.total_processed = 0
        self.total_fraud = 0
        self.total_dlq = 0
        self.total_user_approved = 0
        self.total_compromised_terminals = 0
        self.total_blocked = 0
        self.latencies: List[float] = []
        self.start_time = time.time()

    def record_success(self, latency: float, is_fraud: bool):
        with self.lock:
            self.total_processed += 1
            if is_fraud:
                self.total_fraud += 1
            self.latencies.append(latency)

    def record_dlq(self):
        with self.lock:
            self.total_dlq += 1

    def record_user_approved(self):
        with self.lock:
            self.total_user_approved += 1

    def record_compromised_terminal(self):
        with self.lock:
            self.total_compromised_terminals += 1

    def record_blocked(self):
        with self.lock:
            self.total_blocked += 1

    def get_summary(self) -> dict:
        with self.lock:
            duration = time.time() - self.start_time
            avg_latency = (sum(self.latencies) / len(self.latencies) * 1000) if self.latencies else 0.0
            throughput = self.total_processed / duration if duration > 0 else 0.0
            return {
                "total_processed": self.total_processed,
                "total_fraud": self.total_fraud,
                "total_dlq": self.total_dlq,
                "total_user_approved": self.total_user_approved,
                "total_compromised_terminals": self.total_compromised_terminals,
                "total_blocked": self.total_blocked,
                "avg_latency_ms": avg_latency,
                "throughput_tx_s": throughput,
                "duration_seconds": duration
            }


metrics = PipelineMetrics()


def print_metrics_panel(title: str = "LIVE STREAM METRICS DASHBOARD"):
    stats = metrics.get_summary()
    approved = stats['total_processed'] - stats['total_blocked']
    summary_text = (
        f"[bold white]Processed:[/bold white] {stats['total_processed']} | "
        f"[bold green]Approved:[/bold green] {approved} | "
        f"[bold red]Blocked (Declined):[/bold red] {stats['total_blocked']} | "
        f"[bold red]Compromised Terminals:[/bold red] {stats['total_compromised_terminals']} | "
        f"[bold yellow]DLQ (Errors):[/bold yellow] {stats['total_dlq']}\n"
        f"[bold white]Fraud Flagged (OTP Sent):[/bold white] {stats['total_fraud']} | "
        f"[bold green]User Approved (OTP):[/bold green] {stats['total_user_approved']} | "
        f"[bold white]Avg Latency:[/bold white] {stats['avg_latency_ms']:.2f} ms | "
        f"[bold white]Throughput:[/bold white] {stats['throughput_tx_s']:.2f} tx/s | "
        f"[bold white]Uptime:[/bold white] {stats['duration_seconds']:.1f}s"
    )
    logger.info("\n" + "=" * 60)
    logger.info(f"[bold cyan][METRICS] {title}[/bold cyan]")
    logger.info("-" * 60)
    logger.info(summary_text)
    logger.info("=" * 60 + "\n")


# ---------------------------------------------------------------------- #
# PRODUCER THREAD
# ---------------------------------------------------------------------- #
def run_producer(topic: str, csv_path: Path, speed: float, max_tx: Optional[int] = None):
    logger.info(f"[bold green]Starting Producer Thread... Reading dataset from {csv_path}[/bold green]")
    
    try:
        df = pd.read_csv(csv_path)
    except Exception as exc:
        logger.error(f"Failed to read dataset for production stream: {exc}")
        return

    # Convert timestamps and calculate TX_DAY to extract the test split (Day >= 140)
    df["TX_DATETIME"] = pd.to_datetime(df["TX_DATETIME"])
    t0 = df["TX_DATETIME"].min().normalize()
    df["TX_DAY"] = (df["TX_DATETIME"] - t0).dt.days
    
    # Extract test split transactions sorted chronologically
    test_df = df[df["TX_DAY"] >= 140].sort_values("TX_DATETIME").reset_index(drop=True)
    logger.info(f"Extracted {len(test_df)} test split transactions (Day >= 140) for streaming simulation.")

    # Slice the test dataframe to the limit
    stream_df = test_df.head(max_tx) if max_tx else test_df

    # Inject one transaction of each fraud scenario (1, 2, 3) at the end of the stream
    # so we can guarantee showing the detection alerts, scenario labeling, and TreeSHAP in the demo
    injections = []
    for scen_id in [1, 2, 3]:
        scen_rows = df[df["TX_FRAUD_SCENARIO"] == scen_id]
        if not scen_rows.empty:
            # Grab a row from the holdout/test period to be realistic
            holdout_rows = scen_rows[scen_rows["TX_DAY"] >= 140]
            row_to_use = holdout_rows.iloc[0] if not holdout_rows.empty else scen_rows.iloc[0]
            injections.append(row_to_use)
            
    if injections:
        inj_df = pd.DataFrame(injections)
        stream_df = pd.concat([stream_df, inj_df], ignore_index=True)
        logger.info(f"Appended {len(injections)} guaranteed fraud scenarios (Scenarios 1, 2, & 3) to the stream tail for verification.")

    producer = MockKafkaProducer()
    
    count = 0
    for _, row in stream_df.iterrows():
        if shutdown_event.is_set():
            break

        # Construct raw payload payload (same as a real API gateway request)
        raw_tx = {
            "TRANSACTION_ID": int(row["TRANSACTION_ID"]),
            "CUSTOMER_ID": int(row["CUSTOMER_ID"]),
            "TERMINAL_ID": int(row["TERMINAL_ID"]),
            "TX_DATETIME": str(row["TX_DATETIME"]),
            "TX_AMOUNT": float(row["TX_AMOUNT"]),
            "PHONE_NUMBER": os.getenv("USER_PHONE_NUMBER", "+201093836155"),
            "TX_FRAUD": int(row["TX_FRAUD"])  # Included for feedback loop simulation
        }

        # --- Inject periodic malformed data to verify DLQ routing ---
        if count > 0 and count % 23 == 0:
            # Drop CUSTOMER_ID to simulate a corrupted payload
            del raw_tx["CUSTOMER_ID"]
            logger.info(f"[bold purple]PRODUCER[/bold purple] | Injected malformed transaction ID {raw_tx['TRANSACTION_ID']} (testing DLQ).")

        producer.send(topic, raw_tx)
        
        # Log send event
        logger.info(
            f"[bold blue]PRODUCER SENT[/bold blue] | ID: {raw_tx.get('TRANSACTION_ID')} | Cust: {raw_tx.get('CUSTOMER_ID', 'MISSING')} | Amount: ${raw_tx.get('TX_AMOUNT')}"
        )
        
        count += 1
        time.sleep(speed)
        
    logger.info(f"[bold green]Producer thread finished. Total streamed: {count}[/bold green]")


def input_with_timeout(prompt: str, timeout: float = 40.0) -> str:
    """
    Prompt the user for input on the console. If no input is received
    within the timeout duration (in seconds), print a timeout message and return an empty string.
    """
    try:
        import msvcrt
        import sys
        
        print(prompt, end="", flush=True)
        start_time = time.time()
        input_str = []
        
        while time.time() - start_time < timeout:
            if shutdown_event.is_set():
                print("\n[ABORTED] Shutdown signal received. Exiting input.")
                return ""
            if msvcrt.kbhit():
                char = msvcrt.getwche()
                if char in ("\r", "\n"):
                    print()
                    return "".join(input_str)
                elif char == "\b":
                    if input_str:
                        input_str.pop()
                        # Erase character visually from the console
                        sys.stdout.write(" \b")
                        sys.stdout.flush()
                elif ord(char) >= 32:
                    input_str.append(char)
            time.sleep(0.05)
            
        print("\n\n[TIMEOUT] Verification window expired (40 seconds reached). Blocked.")
        return ""
    except Exception:
        # Fallback for environments where msvcrt is unavailable (e.g. non-Windows)
        import select
        import sys
        
        print(prompt, end="", flush=True)
        elapsed = 0.0
        poll_interval = 0.5
        while elapsed < timeout:
            if shutdown_event.is_set():
                print("\n[ABORTED] Shutdown signal received. Exiting input.")
                return ""
            rlist, _, _ = select.select([sys.stdin], [], [], poll_interval)
            if rlist:
                return sys.stdin.readline().rstrip("\n")
            elapsed += poll_interval
        print("\n\n[TIMEOUT] Verification window expired (40 seconds reached). Blocked.")
        return ""


# ---------------------------------------------------------------------- #
# CONSUMER THREAD
# ---------------------------------------------------------------------- #
def run_consumer(topic: str, dlq_topic: str, explain: bool, interactive: bool, max_tx: Optional[int] = None):
    logger.info("[bold green]Starting Consumer Thread... Loading pipeline model artifacts...[/bold green]")
    
    pipeline = FraudDetectionPipeline.from_artifacts(
        MODELS_DIR,
        load_explainer=explain,
        send_whatsapp_alerts=True
    )
    
    # Warm start feature engineer using historical training data (Day < 140) to seed state
    logger.info("Seeding consumer feature-engineering state (Warm Start) from historical data...")
    try:
        df_hist = pd.read_csv(DATA_DIR / "synthetic_fraud_transactions.csv")
        df_hist["TX_DATETIME"] = pd.to_datetime(df_hist["TX_DATETIME"])
        t0 = df_hist["TX_DATETIME"].min().normalize()
        df_hist["TX_DAY"] = (df_hist["TX_DATETIME"] - t0).dt.days
        
        # Optimize warm start by only replaying history for the streamed customer IDs
        test_slice = df_hist[df_hist["TX_DAY"] >= 140].sort_values("TX_DATETIME")
        limit = 100 if not max_tx else max_tx * 2
        target_customers = test_slice["CUSTOMER_ID"].head(limit).unique().tolist()
        
        train_slice = df_hist[df_hist["TX_DAY"] < 140].sort_values("TX_DATETIME")
        pipeline.warm_start_from_history(train_slice, customer_ids=target_customers)
        logger.info("[bold green][OK] Stateful Warm Start Seeding Completed.[/bold green]")
    except Exception as exc:
        logger.warning(f"Could not warm start feature engineer: {exc}. Pipeline will default to cold starts.")

    consumer = MockKafkaConsumer()
    consumer.subscribe([topic])
    
    # Store reported compromised terminals: terminal_id -> set of customer_ids
    reported_terminals = {}
    
    # Producer instance to route to DLQ
    dlq_producer = MockKafkaProducer()

    logger.info(f"[bold green]Consumer listening to Kafka topic '{topic}'...[/bold green]")

    while not shutdown_event.is_set():
        # Poll message with a short timeout to check shutdown flag regularly
        msg = consumer.poll(timeout=0.1)
        if msg is None:
            continue
        
        if msg.error():
            logger.error(f"Kafka consumer poll error: {msg.error()}")
            continue

        start_processing = time.time()

        # 1. Deserialize JSON bytes
        try:
            raw_bytes = msg.value()
            tx = json.loads(raw_bytes.decode("utf-8"))
        except Exception as exc:
            logger.error(f"[bold red]CONSUMER JSON DESERIALIZATION ERROR[/bold red] | Malformed bytes. Routing to DLQ. Error: {exc}")
            metrics.record_dlq()
            dlq_producer.send(dlq_topic, {"raw_bytes": raw_bytes.hex(), "error": str(exc)})
            continue

        # 2. Schema Validation (Input validation layer)
        required_cols = ["CUSTOMER_ID", "TERMINAL_ID", "TX_DATETIME", "TX_AMOUNT"]
        missing_cols = [col for col in required_cols if col not in tx]
        if missing_cols:
            logger.warning(
                f"[bold yellow][WARNING] CONSUMER SCHEMA VALIDATION ERROR[/bold yellow] | ID: {tx.get('TRANSACTION_ID')} | Missing columns: {missing_cols}. Routing to DLQ.",
                extra={"event_type": "SCHEMA_ERROR", "transaction_id": tx.get("TRANSACTION_ID")}
            )
            metrics.record_dlq()
            dlq_producer.send(dlq_topic, {**tx, "error": f"Missing required columns: {missing_cols}"})
            continue

        # Forward transaction to running GUI backend if available
        import requests
        try:
            payload = {
                "transaction_id": str(tx.get("TRANSACTION_ID")),
                "customer_id": int(tx.get("CUSTOMER_ID")),
                "terminal_id": int(tx.get("TERMINAL_ID")),
                "tx_amount": float(tx.get("TX_AMOUNT")),
                "tx_datetime": str(tx.get("TX_DATETIME")),
            }
            requests.post("http://localhost:8008/api/transactions/simulate", json=payload, timeout=1.0)
        except Exception:
            pass

        # 3. Model Inference & XAI
        try:
            if explain:
                prediction, explanation = pipeline.process_transaction(tx, update_state=True, explain=True)
            else:
                prediction = pipeline.process_transaction(tx, update_state=True, explain=False)
                explanation = None
            
            processing_duration = time.time() - start_processing
            metrics.record_success(processing_duration, prediction.is_fraud)

            # Log prediction
            pred_dict = prediction.to_dict()
            if prediction.is_fraud:
                logger.warning(
                    f"[bold red][ALERT] FRAUD CONSUMER ALERT[/bold red] | ID: {pred_dict['TRANSACTION_ID']} | "
                    f"Prob: {pred_dict['fraud_probability']:.4f} | Scenario: {pred_dict['scenario_name']}"
                )
                
                # Print explanation drivers if explainable AI is enabled
                if explanation:
                    is_rule = any(k.startswith("RULE_") for k in explanation.keys())
                    if is_rule:
                        logger.info("  [bold cyan]Rule Engine driving features:[/bold cyan]")
                        for k, v in explanation.items():
                            if k == "RULE_compromised_terminal":
                                logger.info(f"    [+] Terminal Compromised: Terminal {tx.get('TERMINAL_ID')} is blacklisted due to customer reports.")
                    else:
                        logger.info("  [bold cyan]TreeSHAP driving features:[/bold cyan]")
                        for k, v in sorted(explanation.items(), key=lambda item: abs(item[1]), reverse=True)[:5]:
                            arrow = "[+]" if v > 0 else "[-]"
                            logger.info(f"    {arrow} {k}: {v:+.4f}")

                # OTP Verification flow
                if pred_dict["TRANSACTION_ID"] in pipeline._pending_otps:
                    expected_otp = pipeline._pending_otps[pred_dict["TRANSACTION_ID"]]
                    logger.info(f"  [SECURITY] [bold yellow]OTP Sent:[/bold yellow] [white]{expected_otp}[/white] | Suspending transaction...")
                    
                    if interactive:
                        # Interactive manual entry with 40 seconds timeout
                        user_input = input_with_timeout(
                            f"Enter OTP for transaction {pred_dict['TRANSACTION_ID']} to approve (or press Enter to decline): ",
                            timeout=40.0
                        )
                        if pipeline.confirm_transaction_otp(pred_dict["TRANSACTION_ID"], user_input.strip()):
                            logger.info(f"  [bold green][OK] OTP Confirmed. Transaction Approved.[/bold green]")
                            metrics.record_user_approved()
                        else:
                            logger.error(f"  [bold red][FAIL] OTP Failed/Timeout. Transaction Permanently Blocked.[/bold red]")
                            metrics.record_blocked()
                    else:
                        # Simulated automated response to keep pipeline fluid
                        time.sleep(0.2)
                        # Simulate correct entry 60% of the time, incorrect 40%
                        import random
                        simulated_correct = random.random() < 0.6
                        sub_otp = expected_otp if simulated_correct else "000000"
                        logger.info(f"  [SIM] [bold orange3][SIMULATION][/bold orange3] User entering OTP: {sub_otp}")
                        if pipeline.confirm_transaction_otp(pred_dict["TRANSACTION_ID"], sub_otp):
                            logger.info(f"  [bold green][OK] Simulated OTP Approved.[/bold green]")
                            metrics.record_user_approved()
                        else:
                            logger.error(f"  [bold red][FAIL] Simulated OTP Declined. Blocked.[/bold red]")
                            metrics.record_blocked()
            else:
                logger.info(
                    f"[bold green][OK] CONSUMER APPROVED[/bold green] | ID: {pred_dict['TRANSACTION_ID']} | "
                    f"Prob: {pred_dict['fraud_probability']:.4f}"
                )
                
                # --- Customer Feedback Loop for False Negatives ---
                if tx.get("TX_FRAUD") == 1:
                    logger.warning(
                        f"  [bold yellow][FEEDBACK] Customer {tx['CUSTOMER_ID']} noticed unauthorized activity from Terminal {tx['TERMINAL_ID']} and filed a report.[/bold yellow]"
                    )
                    term_id = tx["TERMINAL_ID"]
                    cust_id = tx["CUSTOMER_ID"]
                    
                    with metrics.lock:
                        if term_id not in reported_terminals:
                            reported_terminals[term_id] = set()
                        reported_terminals[term_id].add(cust_id)
                        
                        # Blacklist terminal immediately on the first customer report
                        if len(reported_terminals[term_id]) >= 1:
                            if term_id not in pipeline.compromised_terminals:
                                pipeline.compromise_terminal(term_id)
                                metrics.record_compromised_terminal()

        except Exception as exc:
            logger.error(f"Failed to process transaction ID {tx.get('TRANSACTION_ID')}: {exc}")

        # Periodic Metrics Panel print (every 10 processed transactions)
        if metrics.total_processed > 0 and metrics.total_processed % 10 == 0:
            print_metrics_panel()

    consumer.close()
    logger.info("[bold green]Consumer thread closed.[/bold green]")


# ---------------------------------------------------------------------- #
# SIGINT HANDLER
# ---------------------------------------------------------------------- #
def handle_sigint(signum, frame):
    logger.warning("\n[bold orange3][WARNING] Shutdown signal received. Stopping threads...[/bold orange3]")
    shutdown_event.set()


if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_sigint)

    parser = argparse.ArgumentParser(description="Real-Time Kafka Fraud Processing Pipeline")
    parser.add_argument("--mode", default="both", choices=["producer", "consumer", "both"],
                        help="Run producer thread, consumer thread, or both concurrently (default: both).")
    parser.add_argument("--speed", type=float, default=0.5,
                        help="Simulated streaming delay in seconds between transactions produced (default: 0.5).")
    parser.add_argument("--max-tx", type=int, default=50,
                        help="Maximum transactions to stream for the run (default: 50).")
    parser.add_argument("--explain", action="store_true", default=True,
                        help="Calculate and print SHAP explanations for flagged transactions (default: True).")
    parser.add_argument("--no-explain", action="store_false", dest="explain",
                        help="Disable SHAP explanation logic to optimize throughput.")
    parser.add_argument("--interactive", action="store_true",
                        help="Pause stream and require manual command-line OTP entries for flagged transactions.")
    args = parser.parse_args()

    topic_name = "transactions"
    dlq_topic_name = "fraud-dlq"

    if args.mode == "both":
        # Launch Producer and Consumer threads together
        producer_thread = threading.Thread(
            target=run_producer,
            args=(topic_name, DATA_DIR / "synthetic_fraud_transactions.csv", args.speed, args.max_tx)
        )
        consumer_thread = threading.Thread(
            target=run_consumer,
            args=(topic_name, dlq_topic_name, args.explain, args.interactive, args.max_tx)
        )

        producer_thread.start()
        consumer_thread.start()

        # Keep main thread alive until threads terminate or Ctrl+C
        try:
            while producer_thread.is_alive() or consumer_thread.is_alive():
                time.sleep(0.5)
        except KeyboardInterrupt:
            shutdown_event.set()
        
        producer_thread.join()
        consumer_thread.join()
        
        print_metrics_panel(title="FINAL STREAM METRICS REPORT")
        
    elif args.mode == "producer":
        run_producer(topic_name, DATA_DIR / "synthetic_fraud_transactions.csv", args.speed, args.max_tx)
        
    elif args.mode == "consumer":
        try:
            run_consumer(topic_name, dlq_topic_name, args.explain, args.interactive, args.max_tx)
        except KeyboardInterrupt:
            shutdown_event.set()
            print_metrics_panel(title="FINAL STREAM METRICS REPORT")
