import logging
import os
from pathlib import Path
from rich.logging import RichHandler
from pythonjsonlogger import jsonlogger

# Ensure logs directory exists
LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
JSON_LOG_FILE = LOG_DIR / "fraud_events.log"

def get_logger(name: str) -> logging.Logger:
    """
    Returns a dual-logger setup:
    1. RichHandler for beautiful, colored terminal output.
    2. JsonFormatter for structured machine-readable logs (saved to logs/fraud_events.log).
    """
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    # Prevent adding handlers multiple times if imported in multiple places
    if logger.handlers:
        return logger

    # --- 1. Human-Readable Console Logger (Rich) ---
    rich_handler = RichHandler(
        rich_tracebacks=True, 
        markup=True, 
        show_path=False, # Hides the file path in terminal to keep it clean
        log_time_format="[%X]"
    )
    rich_formatter = logging.Formatter("%(message)s")
    rich_handler.setFormatter(rich_formatter)
    logger.addHandler(rich_handler)

    # --- 2. Machine-Readable File Logger (JSON) ---
    file_handler = logging.FileHandler(JSON_LOG_FILE)
    # The JSON logger will automatically capture any dictionaries passed in the `extra` parameter
    json_formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"}
    )
    file_handler.setFormatter(json_formatter)
    logger.addHandler(file_handler)

    # Prevent logs from propagating to the root logger and printing twice
    logger.propagate = False

    return logger
