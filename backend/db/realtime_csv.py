"""
db/realtime_csv.py
==================
Thread-safe CSV persistence layer for transactions.
Used to save new transactions, update transaction status (approved/declined/reported),
and retroactively correct Scenario 2 (skimming) labels when a terminal is compromised.
"""
from __future__ import annotations

import csv
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

CSV_LOCK = threading.Lock()
CSV_PATH = Path(__file__).resolve().parents[2] / "data" / "realtime_transactions.csv"


def init_csv():
    """Ensure data/ directory exists and create the CSV file with headers if it doesn't exist."""
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_LOCK:
        if not CSV_PATH.exists():
            with open(CSV_PATH, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "TRANSACTION_ID",
                    "TX_DATETIME",
                    "CUSTOMER_ID",
                    "TERMINAL_ID",
                    "TX_AMOUNT",
                    "TX_TIME_SECONDS",
                    "TX_TIME_DAYS",
                    "TX_FRAUD",
                    "TX_FRAUD_SCENARIO"
                ])


def clear_csv():
    """Clear the CSV file and write headers fresh."""
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CSV_LOCK:
        with open(CSV_PATH, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "TRANSACTION_ID",
                "TX_DATETIME",
                "CUSTOMER_ID",
                "TERMINAL_ID",
                "TX_AMOUNT",
                "TX_TIME_SECONDS",
                "TX_TIME_DAYS",
                "TX_FRAUD",
                "TX_FRAUD_SCENARIO"
            ])
        print(f"[csv] Cleared realtime transactions log at {CSV_PATH}")


def _parse_datetime(dt_str: str) -> datetime:
    try:
        return datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        # Fallback for ISO format
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


def append_transaction(tx_dict: dict, is_fraud: bool, scenario_id: Optional[int]):
    """Append a raw transaction to the CSV file with calculated time offsets."""
    init_csv()
    tx_datetime = tx_dict["TX_DATETIME"]
    dt = _parse_datetime(tx_datetime)

    # Standard dataset start (2019-09-14 00:00:00)
    base_date = datetime(2019, 9, 14, 0, 0, 0)
    dt_naive = dt.replace(tzinfo=None)
    delta = dt_naive - base_date
    tx_time_seconds = int(delta.total_seconds())
    tx_time_days = int(delta.days)

    row = [
        str(tx_dict["TRANSACTION_ID"]),
        dt.strftime("%Y-%m-%d %H:%M:%S"),
        int(tx_dict["CUSTOMER_ID"]),
        int(tx_dict["TERMINAL_ID"]),
        float(tx_dict["TX_AMOUNT"]),
        tx_time_seconds,
        tx_time_days,
        1 if is_fraud else 0,
        int(scenario_id) if scenario_id is not None else 0
    ]

    with CSV_LOCK:
        with open(CSV_PATH, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(row)


def update_transaction_label(transaction_id: str, is_fraud: bool, scenario_id: int):
    """Update a specific transaction's fraud classification labels in the CSV."""
    init_csv()
    temp_path = CSV_PATH.with_suffix(".tmp")
    updated = False
    with CSV_LOCK:
        if not CSV_PATH.exists():
            return
        with open(CSV_PATH, mode="r", newline="", encoding="utf-8") as f_in, \
             open(temp_path, mode="w", newline="", encoding="utf-8") as f_out:
            reader = csv.reader(f_in)
            writer = csv.writer(f_out)

            headers = next(reader)
            writer.writerow(headers)

            for row in reader:
                if row[0] == str(transaction_id):
                    row[7] = "1" if is_fraud else "0"
                    row[8] = str(scenario_id)
                    updated = True
                writer.writerow(row)
        if updated:
            os.replace(temp_path, CSV_PATH)
        else:
            if temp_path.exists():
                os.remove(temp_path)


def retro_propagate_skimming(terminal_id: int, start_time_str: str):
    """
    Retroactively update all transactions at terminal_id that occurred on or after
    start_time_str to be marked as Terminal Skimming (TX_FRAUD=1, TX_FRAUD_SCENARIO=2).
    """
    init_csv()
    start_dt = _parse_datetime(start_time_str).replace(tzinfo=None)
    temp_path = CSV_PATH.with_suffix(".tmp")
    updated = False
    with CSV_LOCK:
        if not CSV_PATH.exists():
            return
        with open(CSV_PATH, mode="r", newline="", encoding="utf-8") as f_in, \
             open(temp_path, mode="w", newline="", encoding="utf-8") as f_out:
            reader = csv.reader(f_in)
            writer = csv.writer(f_out)

            headers = next(reader)
            writer.writerow(headers)

            for row in reader:
                try:
                    row_term_id = int(row[3])
                    row_dt = _parse_datetime(row[1]).replace(tzinfo=None)
                    if row_term_id == int(terminal_id) and row_dt >= start_dt:
                        row[7] = "1"
                        row[8] = "2"  # Terminal Skimming
                        updated = True
                except (ValueError, IndexError):
                    pass
                writer.writerow(row)
        if updated:
            os.replace(temp_path, CSV_PATH)
        else:
            if temp_path.exists():
                os.remove(temp_path)
