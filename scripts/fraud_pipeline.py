"""
fraud_pipeline.py
==================
Production inference pipeline: new transaction in -> engineered features ->
fraud probability + (if flagged) fraud-scenario prediction + SHAP
explanation out.

This is the single entry point you wire into a FastAPI endpoint, a Kafka
consumer, a batch job, etc. It hides the multi-stage machinery (feature
engineering, then the two models, then explainability) behind one small class.

Quick start
-----------
    from fraud_pipeline import FraudDetectionPipeline

    pipeline = FraudDetectionPipeline.from_artifacts("models")

    new_tx = {
        "TRANSACTION_ID": 123456,
        "CUSTOMER_ID": 42,
        "TERMINAL_ID": 917,
        "TX_DATETIME": "2026-07-05 02:14:00",
        "TX_AMOUNT": 189.50,
    }

    result = pipeline.process_transaction(new_tx)
    print(result.to_dict())
    # {'TRANSACTION_ID': 123456, 'fraud_probability': 0.87, 'is_fraud': True,
    #  'scenario_id': 3, 'scenario_name': 'Credential Takeover',
    #  'scenario_confidence': 0.74}

    # same call, plus a dict of per-feature SHAP contributions to the score
    result, explanation = pipeline.process_transaction(new_tx, explain=True)
    explanation["shap_fraud_TX_AMOUNT"]   # this feature's push toward/away from fraud

Batch scoring of a historical/offline DataFrame (already containing engineered
features, e.g. from `train_and_save_models.py`'s `build_training_frames`)
should instead call `FraudModelBundle.predict_batch` directly — see
`models.py`. This script is optimized for one-transaction-at-a-time,
stateful, real-time scoring. For scoring many new transactions from a
dict/list/CSV/Excel source at once (with SHAP columns attached automatically),
use `batch_predictor.FraudBatchPredictor` instead.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple, Union

from feature_engineering import FraudFeatureEngineer
from models import FraudModelBundle, FraudPrediction
from explainability import FraudModelExplainer
from feature_engineering import FEATURE_COLS
from twilio_notifier import WhatsAppNotifier

from scripts.logger import get_logger
logger = get_logger("fraud_pipeline")


class FraudDetectionPipeline:
    """
    End-to-end, stateful fraud-detection pipeline.

    Composition, not inheritance: this class owns a `FraudFeatureEngineer`
    (feature computation + realtime customer state), a `FraudModelBundle`
    (the two trained models), and optionally a `FraudModelExplainer` (SHAP /
    feature importance / PDP-ICE) — and just orchestrates them.
    """

    def __init__(
        self,
        feature_engineer: FraudFeatureEngineer,
        model_bundle: FraudModelBundle,
        explainer: Optional[FraudModelExplainer] = None,
        notifier: Optional[WhatsAppNotifier] = None,
    ):
        self.feature_engineer = feature_engineer
        self.model_bundle = model_bundle
        self.explainer = explainer
        self.notifier = notifier
        # transaction_id -> OTP issued for that flagged transaction, so a
        # later confirm_transaction_otp() call has something to check against.
        self._pending_otps: Dict[object, str] = {}

    # ------------------------------------------------------------------ #
    @classmethod
    def from_artifacts(
        cls, artifacts_dir: str | Path = "models", *, load_explainer: bool = True,
        send_whatsapp_alerts: bool = True,
    ) -> "FraudDetectionPipeline":
        """Load the fitted feature engineer + both trained models from disk,
        and (by default) build a `FraudModelExplainer` on top of them.

        send_whatsapp_alerts : if True (default), also constructs a
            `WhatsAppNotifier` so every transaction flagged as fraud
            automatically triggers a WhatsApp OTP alert (see
            `process_transaction`). The notifier reads
            TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER
            from your `.env` file; if those aren't set, alert-sending is
            silently skipped per-transaction rather than raising here. Set
            False to disable WhatsApp alerts entirely (e.g. in tests, or a
            batch/offline context where nobody should be paged).
        """
        artifacts_dir = Path(artifacts_dir)
        fe = FraudFeatureEngineer.load(artifacts_dir / "feature_engineer.pkl")
        bundle = FraudModelBundle.load(artifacts_dir)
        logger.info("Loaded feature engineer and model bundle from %s", artifacts_dir)

        explainer = None
        if load_explainer:
            try:
                explainer = FraudModelExplainer.from_model_bundle(bundle, FEATURE_COLS)
                logger.info("Explainability (SHAP / feature importance / PDP-ICE) ready.")
            except ImportError as exc:
                logger.warning("Explainability disabled: %s", exc)

        notifier = WhatsAppNotifier() if send_whatsapp_alerts else None
        if notifier is not None and notifier.client is None:
            logger.warning(
                "WhatsApp alerts requested but Twilio credentials are missing — "
                "fraud alerts will be logged but not sent. Set TWILIO_ACCOUNT_SID "
                "and TWILIO_AUTH_TOKEN in your .env to enable them."
            )

        return cls(fe, bundle, explainer, notifier)

    # ------------------------------------------------------------------ #
    def process_transaction(
        self, tx: dict, *, update_state: bool = True, explain: bool = False
    ) -> Union[FraudPrediction, Tuple[FraudPrediction, Dict[str, float]]]:
        """
        Score a single new transaction end-to-end.

        Parameters
        ----------
        tx : dict with keys TRANSACTION_ID, CUSTOMER_ID, TERMINAL_ID,
             TX_DATETIME, TX_AMOUNT.
        update_state : if True (default), the customer's realtime lag /
             velocity buffers are updated after scoring, so the *next*
             transaction from this customer sees this one in its history.
             Set False if you're just re-scoring / simulating and don't
             want to mutate state.
        explain : if True, also returns a dict of per-feature SHAP
             contributions (`shap_fraud_<feature>`, and `shap_scenario_<feature>`
             too if the transaction was flagged as fraud). Requires the
             explainer to have loaded successfully.

        Returns
        -------
        A `FraudPrediction` normally, or `(FraudPrediction, explanation_dict)`
        if `explain=True`.
        """
        features = self.feature_engineer.transform(tx)
        prediction = self.model_bundle.predict_one(features, transaction_id=tx.get("TRANSACTION_ID"))

        if update_state:
            self.feature_engineer.register_realtime_state(tx)

        if prediction.is_fraud:
            logger.warning(
                f"[bold red]🚨 FRAUD FLAGGED[/bold red] | TX: {prediction.transaction_id} | Prob: {prediction.fraud_probability:.3f} | Scenario: {prediction.scenario_name}",
                extra={
                    "event_type": "FRAUD_DETECTED",
                    "transaction_id": prediction.transaction_id,
                    "fraud_probability": prediction.fraud_probability,
                    "scenario": prediction.scenario_name,
                }
            )
            self._send_fraud_alert(tx, prediction)

        if not explain:
            return prediction

        if self.explainer is None:
            raise RuntimeError(
                "explain=True was requested but no explainer is loaded. "
                "Install the 'shap' package and reload with "
                "FraudDetectionPipeline.from_artifacts(..., load_explainer=True)."
            )
        explanation = self.explainer.explain_transaction(
            features, is_fraud=prediction.is_fraud, scenario_id=prediction.scenario_id
        )
        return prediction, explanation

    def process_batch(self, transactions: Iterable[dict], *, update_state: bool = True) -> List[FraudPrediction]:
        """Score a sequence of new transactions in order. Transactions MUST be
        passed in chronological order per customer so lag/velocity features
        stay correct — exactly like the notebooks' sort-then-groupby logic."""
        return [self.process_transaction(tx, update_state=update_state) for tx in transactions]

    # ------------------------------------------------------------------ #
    # WhatsApp fraud alerts (Twilio)
    # ------------------------------------------------------------------ #
    def _send_fraud_alert(self, tx: dict, prediction: FraudPrediction) -> Optional[str]:
        """Send a WhatsApp OTP alert for a transaction that was just flagged
        as fraud, and remember the OTP so `confirm_transaction_otp` can check
        a customer's reply against it later.

        Looks for the customer's phone number on the transaction dict itself
        (`PHONE_NUMBER` or `phone_number`), since the fitted customer/terminal
        profiles don't carry contact info. Never raises: a missing phone
        number, missing Twilio credentials, or a Twilio API error is logged
        and skipped so a notification problem never blocks fraud scoring.
        """
        if self.notifier is None:
            return None

        phone_number = tx.get("PHONE_NUMBER") or tx.get("phone_number")
        if not phone_number:
            logger.warning(
                f"[bold yellow]tx={prediction.transaction_id} flagged as fraud but no PHONE_NUMBER on the transaction — skipping WhatsApp alert.[/bold yellow]",
                extra={"event_type": "OTP_SKIPPED", "transaction_id": prediction.transaction_id}
            )
            return None

        logger.info(
            f"Triggering Twilio WhatsApp OTP for phone number: {phone_number}",
            extra={"event_type": "OTP_REQUESTED", "phone": phone_number, "transaction_id": prediction.transaction_id}
        )

        otp = self.notifier.send_fraud_alert(
            to_phone_number=phone_number,
            transaction_id=str(prediction.transaction_id),
            tx_amount=tx.get("TX_AMOUNT"),
            terminal_id=str(tx.get("TERMINAL_ID")),
        )
        if otp is not None:
            self._pending_otps[prediction.transaction_id] = otp
        return otp

    def confirm_transaction_otp(self, transaction_id, submitted_otp: str) -> bool:
        """Check a customer-submitted OTP against the one sent for
        `transaction_id`'s fraud alert. Returns True and clears the pending
        OTP on a match (one-time use); returns False if it doesn't match or
        no alert is pending for this transaction (e.g. already confirmed,
        expired, or never flagged)."""
        expected = self._pending_otps.get(transaction_id)
        if expected is None:
            logger.warning(
                f"[bold yellow]No pending OTP for tx={transaction_id}.[/bold yellow]",
                extra={"event_type": "OTP_FAILED", "transaction_id": transaction_id, "reason": "NO_PENDING_OTP"}
            )
            return False
        if str(submitted_otp) != expected:
            logger.warning(
                f"[bold red]❌ OTP mismatch for tx={transaction_id}.[/bold red]",
                extra={"event_type": "OTP_FAILED", "transaction_id": transaction_id, "reason": "MISMATCH"}
            )
            return False
        del self._pending_otps[transaction_id]
        logger.info(
            f"[bold green]✅ OTP confirmed for tx={transaction_id}.[/bold green]",
            extra={"event_type": "OTP_VERIFIED", "transaction_id": transaction_id, "status": "APPROVED"}
        )
        return True

    # ------------------------------------------------------------------ #
    # Warm start — see FraudFeatureEngineer for the full docstrings.
    # ------------------------------------------------------------------ #
    def warm_start_from_history(self, history_df, **kwargs) -> dict:
        """Seed every returning customer's realtime lag/velocity state from a
        slice of real transaction history (e.g. the last few hours/days from
        your transactions table) BEFORE this pipeline starts serving live
        traffic. This is what makes a fresh deploy / restart behave like a
        long-running production service instead of treating every existing
        customer's next transaction as if they had no history: without this,
        `process_transaction` would silently fall back to cold-start lag
        features (customer's own mean_amount, zero velocity) for the first
        transaction after every restart — call this once at startup instead."""
        return self.feature_engineer.warm_start_from_history(history_df, **kwargs)

    def warm_start_customer(self, customer_id, history_df) -> bool:
        """Seed a single known customer's realtime state from their real
        transaction history — e.g. lazily, the first time you see a
        customer_id in this process and want to pull their recent history
        from the DB before scoring their next transaction. See
        `FraudFeatureEngineer.warm_start_customer`."""
        return self.feature_engineer.warm_start_customer(customer_id, history_df)

    def is_warm(self, customer_id) -> bool:
        """True if this customer's realtime state already reflects real
        history (from warm start or from having been scored before in this
        process), False if their next transaction would still cold-start."""
        return self.feature_engineer.is_warm(customer_id)

    # ------------------------------------------------------------------ #
    def refresh_daily_risk_stats(self, newly_labeled_tx_df) -> None:
        """Call once per day (batch job) after fraud investigations for the
        previous day are confirmed, to roll terminal/neighborhood risk
        lookups forward. Never called at request-time — keeps scoring
        strictly leakage-free."""
        self.feature_engineer.refresh_daily_risk_stats(newly_labeled_tx_df)
        logger.info("Daily risk stats refreshed.")

    def get_feature_importance(self, model: str = "fraud", importance_type: str = "gain"):
        """Global feature importance for the fraud or scenario model."""
        if self.explainer is None:
            raise RuntimeError("No explainer loaded — see FraudDetectionPipeline.from_artifacts.")
        return self.explainer.global_feature_importance(model=model, importance_type=importance_type)

    def save_state(self, artifacts_dir: str | Path = "models") -> None:
        """Persist the feature engineer (including accumulated realtime
        customer state) so a restarted service resumes without losing
        lag/velocity history."""
        self.feature_engineer.save(Path(artifacts_dir) / "feature_engineer.pkl")


# ---------------------------------------------------------------------- #
# CLI smoke test
# ---------------------------------------------------------------------- #
if __name__ == "__main__":
    import argparse
    import json

    parser = argparse.ArgumentParser(description="Score one transaction from the CLI.")
    parser.add_argument("--artifacts-dir", default="models")
    parser.add_argument("--transaction-json", required=True,
                         help='e.g. \'{"TRANSACTION_ID":1,"CUSTOMER_ID":42,'
                              '"TERMINAL_ID":917,"TX_DATETIME":"2026-07-05 02:14:00",'
                              '"TX_AMOUNT":189.5}\'')
    parser.add_argument("--explain", action="store_true",
                         help="Also print per-feature SHAP contributions.")
    parser.add_argument("--no-whatsapp-alerts", action="store_true",
                         help="Don't send a WhatsApp OTP alert even if the transaction is flagged as fraud.")
    args = parser.parse_args()

    tx = json.loads(args.transaction_json)
    pipeline = FraudDetectionPipeline.from_artifacts(
        args.artifacts_dir, send_whatsapp_alerts=not args.no_whatsapp_alerts
    )

    if args.explain:
        result, explanation = pipeline.process_transaction(tx, explain=True)
        print(json.dumps({**result.to_dict(), **explanation}, indent=2))
    else:
        result = pipeline.process_transaction(tx)
        print(json.dumps(result.to_dict(), indent=2))