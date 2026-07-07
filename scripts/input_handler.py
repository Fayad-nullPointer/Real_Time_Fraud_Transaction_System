"""
input_handler.py
=================
Single responsibility: accept new transaction data from whichever shape is
convenient for the caller — a single Python dict (one transaction), a list
of dicts (many transactions), a pandas DataFrame, a CSV file, or an Excel
file — validate it against the raw schema the feature-engineering pipeline
expects, and hand back clean, ordered per-transaction records.

This module does NOT do any feature engineering or modeling. It only reads,
validates, and normalizes raw input, so `feature_engineering.py` and
`models.py` never need to know or care where the data came from.

Required raw columns (see `REQUIRED_COLUMNS` / `RAW_TX_SCHEMA`):

    TRANSACTION_ID   optional; any hashable identifier. Auto-generated if
                     missing so results can still be joined back to input.
    CUSTOMER_ID      required; must match a CUSTOMER_ID the feature engineer
                     was fitted on (i.e. an existing customer profile).
    TERMINAL_ID      required; must match a TERMINAL_ID the feature engineer
                     was fitted on (i.e. an existing terminal profile).
    TX_DATETIME      required; parseable date/time, e.g. "2026-07-05 02:14:00".
    TX_AMOUNT        required; numeric, > 0.

Any other columns present in the input are ignored — this pipeline computes
all engineered features itself from these five raw fields plus the fitted
customer/terminal profiles, exactly as `02-preprocessing_and_feature_engineering.ipynb`
does at training time.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Union

import pandas as pd

RAW_TX_SCHEMA = {
    "TRANSACTION_ID": "optional identifier (int/str) — auto-generated if absent",
    "CUSTOMER_ID": "must match a CUSTOMER_ID the feature engineer was fitted on",
    "TERMINAL_ID": "must match a TERMINAL_ID the feature engineer was fitted on",
    "TX_DATETIME": "parseable date/time, e.g. '2026-07-05 02:14:00'",
    "TX_AMOUNT": "transaction amount, numeric > 0",
}
REQUIRED_COLUMNS = ["CUSTOMER_ID", "TERMINAL_ID", "TX_DATETIME", "TX_AMOUNT"]
ALL_COLUMNS = ["TRANSACTION_ID"] + REQUIRED_COLUMNS

InputSource = Union[str, Path, dict, List[dict], pd.DataFrame]


class InputValidationError(ValueError):
    """Raised when supplied transaction data doesn't match the required schema."""


class TransactionInputLoader:
    """Reads and validates new-transaction input from list / DataFrame / CSV / Excel sources."""

    SUPPORTED_FILE_EXTENSIONS = {".csv", ".xlsx", ".xls"}

    # ------------------------------------------------------------------ #
    # Reading
    # ------------------------------------------------------------------ #
    @classmethod
    def load(cls, source: InputSource) -> pd.DataFrame:
        """Load `source` into a raw pandas DataFrame. No validation is done here
        — call `.validate()` (or use `.load_and_validate()`) before using the result."""
        if isinstance(source, pd.DataFrame):
            return source.copy()

        if isinstance(source, dict):
            return pd.DataFrame([source])

        if isinstance(source, list):
            if not source:
                raise InputValidationError("Input list of transactions is empty.")
            if not all(isinstance(row, dict) for row in source):
                raise InputValidationError(
                    "Input list must contain dicts, one per transaction, e.g. "
                    '{"CUSTOMER_ID": 42, "TERMINAL_ID": 917, '
                    '"TX_DATETIME": "2026-07-05 02:14:00", "TX_AMOUNT": 189.5}'
                )
            return pd.DataFrame(source)

        if isinstance(source, (str, Path)):
            path = Path(source)
            if not path.exists():
                raise FileNotFoundError(f"Input file not found: {path}")
            suffix = path.suffix.lower()
            if suffix == ".csv":
                return pd.read_csv(path)
            if suffix in (".xlsx", ".xls"):
                return pd.read_excel(path)
            raise InputValidationError(
                f"Unsupported file type '{suffix}'. Supported: "
                f"{sorted(cls.SUPPORTED_FILE_EXTENSIONS)}"
            )

        raise InputValidationError(
            f"Unsupported input type {type(source).__name__!r}. Expected a single "
            f"transaction dict, a list of dicts, a pandas DataFrame, or a path to "
            f"a .csv/.xlsx/.xls file."
        )

    # ------------------------------------------------------------------ #
    # Validation / cleaning
    # ------------------------------------------------------------------ #
    @classmethod
    def validate(cls, df: pd.DataFrame) -> pd.DataFrame:
        """Check schema, coerce dtypes, and return a cleaned copy ordered by
        `ALL_COLUMNS`. Raises `InputValidationError` with a precise, actionable
        message the first time something doesn't match the expected schema."""
        if df.empty:
            raise InputValidationError("Input contains zero transaction rows.")

        missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
        if missing:
            raise InputValidationError(
                f"Missing required column(s): {missing}. "
                f"Required schema: {RAW_TX_SCHEMA}"
            )

        df = df.copy()
        if "TRANSACTION_ID" not in df.columns:
            df["TRANSACTION_ID"] = range(len(df))
        df = df[ALL_COLUMNS]

        # TX_DATETIME must parse
        try:
            df["TX_DATETIME"] = pd.to_datetime(df["TX_DATETIME"])
        except Exception as exc:
            raise InputValidationError(f"Could not parse TX_DATETIME values: {exc}") from exc

        # TX_AMOUNT must be numeric and strictly positive
        df["TX_AMOUNT"] = pd.to_numeric(df["TX_AMOUNT"], errors="coerce")
        bad_amount = df["TX_AMOUNT"].isna() | (df["TX_AMOUNT"] <= 0)
        if bad_amount.any():
            raise InputValidationError(
                f"TX_AMOUNT must be numeric and > 0. Offending row index(es): "
                f"{df.index[bad_amount].tolist()}"
            )

        # CUSTOMER_ID / TERMINAL_ID must be present (not null)
        for col in ("CUSTOMER_ID", "TERMINAL_ID"):
            if df[col].isna().any():
                raise InputValidationError(
                    f"Null {col} at row index(es): {df.index[df[col].isna()].tolist()}"
                )

        # TRANSACTION_ID must be unique — needed to join predictions back to input
        if df["TRANSACTION_ID"].duplicated().any():
            dupes = df.loc[df["TRANSACTION_ID"].duplicated(), "TRANSACTION_ID"].tolist()
            raise InputValidationError(f"Duplicate TRANSACTION_ID value(s): {dupes}")

        return df.reset_index(drop=True)

    @classmethod
    def load_and_validate(cls, source: InputSource) -> pd.DataFrame:
        """Convenience: `validate(load(source))` in one call."""
        return cls.validate(cls.load(source))

    # ------------------------------------------------------------------ #
    # Conversion for downstream consumption
    # ------------------------------------------------------------------ #
    @staticmethod
    def to_records(df: pd.DataFrame) -> List[dict]:
        """Convert a validated DataFrame into a list of per-transaction dicts,
        sorted chronologically per customer. This ordering matters: the
        feature engineer's lag / velocity features assume transactions arrive
        in the same order the notebooks used
        (`sort_values(["CUSTOMER_ID", "TX_DATETIME"])`)."""
        ordered = df.sort_values(["CUSTOMER_ID", "TX_DATETIME"]).reset_index(drop=True)
        return ordered.to_dict("records")
