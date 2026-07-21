"""
feature_engineering.py
=======================
Reproduces the 25-feature engineering pipeline from
`02-preprocessing_and_feature_engineering.ipynb` as a reusable, stateful,
leakage-safe OOP component.

Two usage modes
----------------
1. BATCH (training time):
       fe = FraudFeatureEngineer()
       fe.fit(customer_df, terminal_df, historical_tx_df)
       train_df, holdout_df, oot_df = fe.build_training_frames(historical_tx_df)

2. ONLINE (inference time, one transaction at a time):
       fe = FraudFeatureEngineer.load("models/feature_engineer.pkl")
       features = fe.transform(new_tx)          # returns a 1-row DataFrame
       fe.register_realtime_state(new_tx)       # updates lag/velocity buffers

   `terminal_fraud_rate_*`, `night_fraud_rate` and `neigh_fraud_rate` are
   "slow" features: by design (see notebook, section 10) they are computed
   from *confirmed* fraud labels up to yesterday, so they only change once
   a day. Call `refresh_daily_risk_stats(labeled_tx_df)` once per day
   (e.g. in a nightly batch job) after fraud investigations for previous
   days have been confirmed. This keeps the online path leakage-free:
   nothing about "today" is ever used to score "today"'s transactions.

New-customer cold start & warm start
-------------------------------------
Two related but distinct concerns for customers the feature engineer didn't
see at `fit()` time (or hasn't seen yet in THIS process):

* COLD START (`register_new_customer` / `is_cold_start`) — a customer who
  is genuinely brand new (no history anywhere). They're given a
  population-default profile so `transform()` never crashes on an unknown
  CUSTOMER_ID, and that profile is incrementally replaced by their own
  observed mean/std (Welford's algorithm, O(1) per transaction) as they
  transact, via `register_realtime_state`.

* WARM START (`warm_start_customer` / `warm_start_from_history` / `is_warm`)
  — a customer who already has REAL history (e.g. in your transactions
  table) but whose realtime lag/velocity buffers are empty because this
  process just started/restarted. Warm starting replays their recent real
  history through `register_realtime_state` so their very next transaction
  sees accurate lag/velocity features instead of a cold-started empty
  buffer. This does NOT touch `customer_profiles_` / cold-start promotion —
  it only seeds the realtime deques used for tx_count_1h/4h,
  PREV_TX_AMOUNT_lag*, and terminal velocity features.
"""

from __future__ import annotations

import logging
import pickle
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Dict, Optional

import numpy as np
import pandas as pd
from scipy.spatial import KDTree

logger = logging.getLogger("feature_engineering")

NIGHT_HOURS = {0, 1, 2, 3, 4}
SMALL_TX = 10.0
LARGE_TX = 150.0
EPS = 1e-9
TRAIN_DAYS = 140
HOLDOUT_END_DAY = 162

# Final feature list — must match training-time column order exactly.
FEATURE_COLS = [
    "TX_AMOUNT",
    "hour",
    "distance",
    "Z_score",
    "amount_to_mean_ratio",
    "peer_group_amount_ratio",
    "is_night",
    "tx_count_1h",
    "tx_count_4h",
    "night_velocity",
    "terminal_fraud_rate_3d",
    "terminal_fraud_rate_7d",
    "terminal_fraud_rate_28d",
    "night_fraud_rate",
    "PREV_TX_AMOUNT_lag1",
    "PREV_TX_AMOUNT_lag2",
    "PREV_TX_AMOUNT_lag3",
    "ratio_to_lag1",
    "ratio_to_lag2",
    "ratio_to_lag3",
    "is_test_tx_sequence",
    "neigh_fraud_rate",
    "mean_nb_tx_per_day",
    "nb_terminals",
    "day_of_week",
    "terminal_tx_count_1h",
    "terminal_tx_count_4h",
    "terminal_distinct_customers_1h",
]


def _to_naive_ts(value) -> pd.Timestamp:
    """
    Normalize any incoming timestamp (naive string, tz-aware datetime from
    asyncpg/Postgres, naive Timestamp from training CSVs, etc.) to a naive
    pandas Timestamp in UTC wall-clock terms.

    Without this, mixing tz-aware sources (e.g. warm-starting from a
    TIMESTAMPTZ column) with tz-naive sources (e.g. live `TX_DATETIME`
    strings built with `datetime.strftime`) crashes `ts - t` comparisons
    with "Cannot subtract tz-naive and tz-aware datetime-like objects."
    Every timestamp that enters `_customer_state` / `_terminal_state` must
    go through here so all comparisons stay apples-to-apples.
    """
    ts = pd.Timestamp(value)
    if ts.tzinfo is not None:
        ts = ts.tz_convert("UTC").tz_localize(None)
    return ts

@dataclass
class _CustomerState:
    """Rolling, per-customer realtime state used for lag / velocity features."""
    last_amounts: Deque[float] = field(default_factory=lambda: deque(maxlen=3))
    recent_tx_times: Deque[pd.Timestamp] = field(default_factory=lambda: deque(maxlen=2000))
    # Online (Welford's algorithm) running mean/variance of this customer's
    # OWN transaction amounts. Only accumulated for cold-started customers —
    # this is what lets a brand-new customer's profile self-correct away
    # from the population default toward their real behavior, one
    # transaction at a time, with no retraining and O(1) work per update.
    running_n: int = 0
    running_mean: float = 0.0
    running_m2: float = 0.0

@dataclass
class _TerminalState:
    """Rolling, per-terminal realtime state used for terminal velocity features."""
    recent_tx_times: Deque[pd.Timestamp] = field(default_factory=lambda: deque(maxlen=2000))
    recent_customers: Deque[int] = field(default_factory=lambda: deque(maxlen=2000))


class FraudFeatureEngineer:
    """Stateful, leakage-safe feature engineer for the credit-card fraud pipeline."""

    def __init__(self, neighbor_radius: float = 1.0):
        self.neighbor_radius = neighbor_radius

        # static lookups learned at fit time
        self.customer_profiles_: Optional[pd.DataFrame] = None   # indexed by CUSTOMER_ID
        self.terminal_profiles_: Optional[pd.DataFrame] = None   # indexed by TERMINAL_ID
        self.tier_bins_: Optional[np.ndarray] = None
        self.tier_labels_ = ["Q1_low", "Q2_mid_low", "Q3_mid_high", "Q4_high"]
        self.customer_tier_: Optional[pd.Series] = None          # CUSTOMER_ID -> tier
        self.peer_mean_lookup_: Optional[pd.Series] = None       # tier -> mean amount

        # "slow" daily risk stats, refreshed once a day
        self.daily_terminal_stats_: Optional[pd.DataFrame] = None    # TERMINAL_ID, TX_DAY -> fraud/count
        self.terminal_risk_lookup_: Dict[int, dict] = {}              # TERMINAL_ID -> latest rates
        self.terminal_neighbors_: Dict[int, list] = {}                 # TERMINAL_ID -> [(neighbor_id, weight)]
        self.t0_: Optional[pd.Timestamp] = None                        # day-0 anchor

        # realtime per-customer state (lags / velocity)
        self._customer_state: Dict[int, _CustomerState] = defaultdict(_CustomerState)

        # realtime per-terminal state
        self._terminal_state: Dict[int, _TerminalState] = defaultdict(_TerminalState)

        # --- new-customer cold start -----------------------------------
        # Population-level fallback stats (set at fit time) used to build a
        # profile for a customer who didn't exist in the training data.
        self.global_defaults_: Dict[str, float] = {}
        # CUSTOMER_IDs currently running on a default (not yet "real")
        # profile. Membership here is what `is_cold_start()` reports and
        # what `register_realtime_state` uses to know whose stats to learn
        # online. A customer is removed from this set once they've sent
        # enough real transactions to trust their own observed mean/std.
        self._cold_start_ids: set = set()
        # How many of a new customer's own transactions to observe before
        # replacing the population-default mean/std with their real ones.
        self.COLD_START_PROMOTE_AFTER: int = 5

        self.is_fitted = False

    # ------------------------------------------------------------------ #
    # FIT — learn everything that must not leak from train -> test
    # ------------------------------------------------------------------ #
    def fit(
        self,
        customer_df: pd.DataFrame,
        terminal_df: pd.DataFrame,
        historical_tx_df: pd.DataFrame,
    ) -> "FraudFeatureEngineer":
        """
        Parameters
        ----------
        customer_df : raw customer_profiles.csv
        terminal_df : raw terminal_profiles.csv
        historical_tx_df : raw synthetic_fraud_transactions.csv (must include
            TX_FRAUD ground-truth labels — used only for rows whose TX_DAY <
            TRAIN_DAYS, exactly like the notebook's chronological split).
        """
        self.customer_profiles_ = customer_df.set_index("CUSTOMER_ID")
        self.terminal_profiles_ = terminal_df.set_index("TERMINAL_ID")

        tx = historical_tx_df.copy()
        tx["TX_DATETIME"] = pd.to_datetime(tx["TX_DATETIME"])
        self.t0_ = tx["TX_DATETIME"].min().normalize()
        tx["TX_DAY"] = (tx["TX_DATETIME"] - self.t0_).dt.days

        # ---- spending tiers (static, from customer profiles only) -------
        self.tier_bins_ = customer_df["mean_amount"].quantile([0, 0.25, 0.50, 0.75, 1.0]).values
        tiers = pd.cut(
            customer_df["mean_amount"], bins=self.tier_bins_,
            labels=self.tier_labels_, include_lowest=True,
        )
        self.customer_tier_ = pd.Series(tiers.values, index=customer_df["CUSTOMER_ID"])

        # ---- population defaults for brand-new (never-trained-on) customers
        # Cheap to compute once here; used by `register_new_customer` so a
        # customer who signs up after training never crashes `transform()`.
        self.global_defaults_ = {
            "mean_amount": float(customer_df["mean_amount"].mean()),
            "std_amount": float(customer_df["std_amount"].mean()),
            "mean_nb_tx_per_day": float(customer_df["mean_nb_tx_per_day"].median()),
            "nb_terminals": float(customer_df["nb_terminals"].median()),
            "x_customer_id": float(customer_df["x_customer_id"].mean()),
            "y_customer_id": float(customer_df["y_customer_id"].mean()),
        }

        # ---- peer group mean, fit on TRAIN rows only ---------------------
        tx_tier = tx["CUSTOMER_ID"].map(self.customer_tier_)
        train_mask = tx["TX_DAY"] < TRAIN_DAYS
        self.peer_mean_lookup_ = (
            tx.loc[train_mask].assign(spending_tier=tx_tier[train_mask])
            .groupby("spending_tier", observed=False)["TX_AMOUNT"].mean()
        )

        # ---- daily terminal fraud aggregation (basis for rolling rates) --
        self._rebuild_daily_terminal_stats(tx)

        # ---- spatial neighbor graph (static terminal coordinates) --------
        self._build_neighbor_graph(terminal_df)

        # ---- refresh "slow" rolling risk lookups up to the latest day ----
        self._recompute_risk_lookups()

        self.is_fitted = True
        return self

    # ------------------------------------------------------------------ #
    # New-customer cold start
    # ------------------------------------------------------------------ #
    def register_new_customer(
        self, customer_id, *, x: Optional[float] = None, y: Optional[float] = None,
        mean_amount: Optional[float] = None, std_amount: Optional[float] = None,
        mean_nb_tx_per_day: Optional[float] = None, nb_terminals: Optional[float] = None,
    ) -> None:
        """
        Give a customer who was never in the training data (i.e. signed up
        after the feature engineer was fit) a usable profile immediately,
        using population-level defaults for anything not supplied — so
        `transform()` never has to crash on an unknown CUSTOMER_ID.

        This is O(1): it only inserts one row into `customer_profiles_` /
        `customer_tier_`, no retraining and no rebuilding of any lookup
        table. The customer is marked cold-started; `register_realtime_state`
        will incrementally learn their real mean/std from their own
        transactions and silently promote them once
        `COLD_START_PROMOTE_AFTER` transactions have been observed.

        Safe to call more than once for the same id (idempotent no-op if
        the customer already has a REAL, non-default profile).
        Pass explicit `x`/`y`/etc. if you know anything about the new
        customer at signup time (e.g. their registered address) — anything
        left as None falls back to the population default.
        """
        if not self.is_fitted:
            raise RuntimeError("Call `.fit()` before registering new customers.")
        if customer_id in self.customer_profiles_.index and customer_id not in self._cold_start_ids:
            return  # already a known, real customer — never clobber real stats

        d = self.global_defaults_
        profile = {
            "x_customer_id": x if x is not None else d["x_customer_id"],
            "y_customer_id": y if y is not None else d["y_customer_id"],
            "mean_amount": mean_amount if mean_amount is not None else d["mean_amount"],
            "std_amount": std_amount if std_amount is not None else d["std_amount"],
            "mean_nb_tx_per_day": mean_nb_tx_per_day if mean_nb_tx_per_day is not None else d["mean_nb_tx_per_day"],
            "nb_terminals": nb_terminals if nb_terminals is not None else d["nb_terminals"],
        }
        self.customer_profiles_.loc[customer_id] = profile

        tier = pd.cut(
            [profile["mean_amount"]], bins=self.tier_bins_,
            labels=self.tier_labels_, include_lowest=True,
        )[0]
        self.customer_tier_.loc[customer_id] = (
            tier if pd.notna(tier) else self.tier_labels_[len(self.tier_labels_) // 2]
        )

        self._cold_start_ids.add(customer_id)
        logger.info(
            "Registered new CUSTOMER_ID=%s with a population-default profile "
            "(cold start) — will self-correct after %d real transactions.",
            customer_id, self.COLD_START_PROMOTE_AFTER,
        )

    def is_cold_start(self, customer_id) -> bool:
        """True if `customer_id` is still being scored on a population-
        default profile rather than their own real, learned statistics."""
        if customer_id not in self._cold_start_ids:
            return False
        state = self._customer_state.get(customer_id)
        if state and state.running_n >= self.COLD_START_PROMOTE_AFTER:
            self._cold_start_ids.discard(customer_id)
            return False
        return True

    # ------------------------------------------------------------------ #
    # Warm start — seed realtime lag/velocity buffers from REAL history
    # ------------------------------------------------------------------ #
    def warm_start_customer(self, customer_id, history_df: pd.DataFrame) -> bool:
        """
        Seed a single known customer's realtime lag/velocity state from a
        slice of their REAL transaction history and update profile baselines.
        """
        if not self.is_fitted:
            raise RuntimeError("Call `.fit()` / `.load()` before warm-starting.")

        cust_hist = history_df.loc[history_df["CUSTOMER_ID"] == customer_id].copy()
        if cust_hist.empty:
            return False

        cust_hist["TX_AMOUNT"] = cust_hist["TX_AMOUNT"].astype(float)
        cust_hist["TX_DATETIME"] = pd.to_datetime(cust_hist["TX_DATETIME"], utc=True).dt.tz_localize(None)
        cust_hist = cust_hist.sort_values("TX_DATETIME")

        # Replay transactions to seed velocity deques
        for _, row in cust_hist.iterrows():
            self.register_realtime_state({
                "CUSTOMER_ID": customer_id,
                "TERMINAL_ID": row["TERMINAL_ID"],
                "TX_DATETIME": row["TX_DATETIME"],
                "TX_AMOUNT": row["TX_AMOUNT"],
            })

        # Calculate actual mean & std from real database transactions
        real_mean = float(cust_hist["TX_AMOUNT"].mean())
        real_std = float(cust_hist["TX_AMOUNT"].std()) if len(cust_hist) > 1 else float(self.global_defaults_["std_amount"])
        if np.isnan(real_std) or real_std == 0:
            real_std = float(self.global_defaults_["std_amount"])

        if customer_id not in self.customer_profiles_.index:
            self.register_new_customer(customer_id)

        self.customer_profiles_.loc[customer_id, "mean_amount"] = round(real_mean, 2)
        self.customer_profiles_.loc[customer_id, "std_amount"] = round(real_std, 2)

        state = self._customer_state.get(customer_id)
        if state:
            state.running_n = len(cust_hist)
            state.running_mean = real_mean

        if (state and state.running_n >= self.COLD_START_PROMOTE_AFTER) or len(cust_hist) >= self.COLD_START_PROMOTE_AFTER:
            self._cold_start_ids.discard(customer_id)
        return True

    def warm_start_from_history(self, history_df: pd.DataFrame, *, customer_ids=None) -> dict:
        """
        Seed EVERY returning customer's realtime state from `history_df` in
        one call — intended to be run once at service startup (right after
        `from_artifacts()` / `.load()`), so a fresh deploy or restart
        behaves like a long-running process instead of treating every
        existing customer's next transaction as if they had no history.

        Parameters
        ----------
        history_df : a DataFrame with CUSTOMER_ID, TERMINAL_ID, TX_DATETIME,
            TX_AMOUNT columns — e.g. the last few hours/days pulled from
            your transactions table. Rows are grouped and replayed per
            customer, in chronological order.
        customer_ids : optional subset of CUSTOMER_IDs to warm start (e.g.
            only currently-active customers). Defaults to every distinct
            CUSTOMER_ID present in `history_df`.

        Returns
        -------
        dict with `customers_warmed` (had history to replay) and
        `customers_skipped` (no rows found in `history_df`) counts, so
        callers can log/monitor how "warm" the process came up.
        """
        if not self.is_fitted:
            raise RuntimeError("Call `.fit()` / `.load()` before warm-starting.")

        ids = customer_ids if customer_ids is not None else history_df["CUSTOMER_ID"].unique()

        warmed = 0
        skipped = 0
        for cid in ids:
            if self.warm_start_customer(cid, history_df):
                warmed += 1
            else:
                skipped += 1

        logger.info(
            "Warm start complete: %d customer(s) warmed, %d skipped (no history found).",
            warmed, skipped,
        )
        return {"customers_warmed": warmed, "customers_skipped": skipped}

    def is_warm(self, customer_id) -> bool:
        """
        True if `customer_id` already has realtime lag/velocity state in
        THIS process (from a prior warm start, or from having been scored
        before), False if their next transaction would still cold-start on
        empty buffers (i.e. see no prior transactions in tx_count_1h/4h or
        PREV_TX_AMOUNT_lag*, even if they're a perfectly well-known
        customer in `customer_profiles_`).

        Note: this is about realtime STATE freshness, not about
        `is_cold_start` (which is about whether the customer's stored
        profile itself is a population default vs. their own real stats).
        A customer can be "not cold start" (known profile) and still
        "not warm" (empty realtime buffers) right after a restart.
        """
        state = self._customer_state.get(customer_id)
        return bool(state and len(state.recent_tx_times) > 0)

    def get_debug_state(self, customer_id) -> dict:
        """
        Snapshot of everything this feature engineer currently knows about
        `customer_id` — for verifying that realtime lag/velocity state is
        updating correctly (e.g. an admin "inspect model state" view).

        NOTE: tx_count_1h/4h here are computed against wall-clock "now" for
        display purposes. At actual scoring time they're computed against the
        incoming transaction's own TX_DATETIME instead, so these numbers are
        an approximation, not exactly what the next `transform()` call will see.
        """
        if not self.is_fitted:
            raise RuntimeError("Feature engineer is not fitted / loaded.")

        if customer_id not in self.customer_profiles_.index:
            self.register_new_customer(customer_id)

        known = customer_id in self.customer_profiles_.index
        state = self._customer_state.get(customer_id)

        cust = self.customer_profiles_.loc[customer_id]
        mean_amt = float(cust["mean_amount"])
        std_amt = float(cust["std_amount"])

        # If online state has learned a mean/std, report the online state
        if state is not None and state.running_n > 0:
            if state.running_mean is not None:
                mean_amt = float(state.running_mean)
            if state.running_n > 1 and state.running_m2 > 0:
                std_amt = float(np.sqrt(state.running_m2 / (state.running_n - 1)))

        out = {
            "customer_id": customer_id,
            "known_profile": known,
            "is_cold_start": self.is_cold_start(customer_id),
            "is_warm": self.is_warm(customer_id),
            "profile": {
                "mean_amount": round(mean_amt, 2),
                "std_amount": round(std_amt, 2),
                "mean_nb_tx_per_day": float(cust.get("mean_nb_tx_per_day", 1.0)),
                "nb_terminals": float(cust.get("nb_terminals", 1.0)),
                "x_customer_id": float(cust.get("x_customer_id", 0.0)),
                "y_customer_id": float(cust.get("y_customer_id", 0.0)),
            },
            "spending_tier": str(self.customer_tier_.get(customer_id, "Standard")),
        }

        if state is not None:
            now = pd.Timestamp.utcnow().tz_localize(None)
            recent = list(state.recent_tx_times)
            out["realtime"] = {
                "last_amounts_chronological": list(state.last_amounts),
                "tx_count_1h_approx": sum(1 for t in recent if now - t < pd.Timedelta(hours=1)),
                "tx_count_4h_approx": sum(1 for t in recent if now - t < pd.Timedelta(hours=4)),
                "buffered_tx_times": [str(t) for t in recent],
                "cold_start_running_n": state.running_n,
                "cold_start_running_mean": state.running_mean if state.running_n else None,
            }
        else:
            out["realtime"] = {
                "last_amounts_chronological": [],
                "tx_count_1h_approx": 0,
                "tx_count_4h_approx": 0,
                "buffered_tx_times": [],
                "cold_start_running_n": 0,
                "cold_start_running_mean": None,
            }

        return out

    # ------------------------------------------------------------------ #
    # Daily risk-stat maintenance (call nightly with newly confirmed labels)
    # ------------------------------------------------------------------ #
    def _rebuild_daily_terminal_stats(self, tx: pd.DataFrame) -> None:
        daily = (
            tx.groupby(["TERMINAL_ID", "TX_DAY"])
            .agg(daily_fraud=("TX_FRAUD", "sum"), daily_count=("TX_FRAUD", "count"))
            .reset_index()
        )
        daily_night = (
            tx[tx["TX_DATETIME"].dt.hour.isin(NIGHT_HOURS)]
            .groupby(["TERMINAL_ID", "TX_DAY"])
            .agg(nightly_fraud=("TX_FRAUD", "sum"), nightly_count=("TX_FRAUD", "count"))
            .reset_index()
        )
        self.daily_terminal_stats_ = daily.merge(
            daily_night, on=["TERMINAL_ID", "TX_DAY"], how="left"
        ).fillna(0)

    def refresh_daily_risk_stats(self, newly_labeled_tx_df: pd.DataFrame) -> None:
        """
        Incorporate a new day's worth of *confirmed* fraud labels and
        recompute rolling risk lookups. Intended to be run once per day
        (e.g. as a scheduled batch job), never at request-time.
        """
        tx = newly_labeled_tx_df.copy()
        tx["TX_DATETIME"] = pd.to_datetime(tx["TX_DATETIME"])
        tx["TX_DAY"] = (tx["TX_DATETIME"] - self.t0_).dt.days
        self._rebuild_daily_terminal_stats(
            pd.concat([self._stats_to_tx_like(), tx], ignore_index=True)
            if self.daily_terminal_stats_ is not None else tx
        )
        self._recompute_risk_lookups()

    def _stats_to_tx_like(self) -> pd.DataFrame:
        """Reconstruct a transaction-shaped frame from stored daily stats so
        `_rebuild_daily_terminal_stats` can be reused for incremental updates."""
        rows = []
        for _, r in self.daily_terminal_stats_.iterrows():
            n_fraud = int(r["daily_fraud"])
            n_total = int(r["daily_count"])
            for i in range(n_total):
                rows.append({
                    "TERMINAL_ID": r["TERMINAL_ID"], "TX_DAY": r["TX_DAY"],
                    "TX_FRAUD": 1 if i < n_fraud else 0,
                    "TX_DATETIME": self.t0_ + pd.Timedelta(days=int(r["TX_DAY"])),
                })
        return pd.DataFrame(rows) if rows else pd.DataFrame(
            columns=["TERMINAL_ID", "TX_DAY", "TX_FRAUD", "TX_DATETIME"]
        )

    @staticmethod
    def _rolling_rate(fraud_series: pd.Series, count_series: pd.Series, window: int) -> pd.Series:
        fraud_roll = fraud_series.shift(1).rolling(window, min_periods=1).sum()
        count_roll = count_series.shift(1).rolling(window, min_periods=1).sum().clip(lower=1)
        return (fraud_roll / count_roll).fillna(0)

    def _recompute_risk_lookups(self) -> None:
        """Recompute terminal_fraud_rate_3d/7d/28d, night_fraud_rate and
        neigh_fraud_rate for the *latest available day* per terminal, and
        cache them for O(1) lookup during online scoring."""
        d = self.daily_terminal_stats_.sort_values(["TERMINAL_ID", "TX_DAY"])
        out = {}
        rate7d_by_terminal_day = {}
        for term_id, g in d.groupby("TERMINAL_ID"):
            g = g.reset_index(drop=True)
            r3 = self._rolling_rate(g["daily_fraud"], g["daily_count"], 3)
            r7 = self._rolling_rate(g["daily_fraud"], g["daily_count"], 7)
            r28 = self._rolling_rate(g["daily_fraud"], g["daily_count"], 28)
            rn7 = self._rolling_rate(g["nightly_fraud"], g["nightly_count"], 7)
            last = g["TX_DAY"].iloc[-1]
            out[term_id] = {
                "TX_DAY": int(last),
                "terminal_fraud_rate_3d": float(r3.iloc[-1]),
                "terminal_fraud_rate_7d": float(r7.iloc[-1]),
                "terminal_fraud_rate_28d": float(r28.iloc[-1]),
                "night_fraud_rate": float(rn7.iloc[-1]),
            }
            for day, val in zip(g["TX_DAY"], r7):
                rate7d_by_terminal_day[(term_id, int(day))] = val
        self.terminal_risk_lookup_ = out

        # neighborhood fraud rate = weighted avg of neighbors' terminal_fraud_rate_7d
        for term_id, neighbors in self.terminal_neighbors_.items():
            if term_id not in self.terminal_risk_lookup_:
                continue
            latest_day = self.terminal_risk_lookup_[term_id]["TX_DAY"]
            vals = [
                rate7d_by_terminal_day.get((nid, latest_day), 0.0) * w
                for nid, w in neighbors
            ]
            self.terminal_risk_lookup_[term_id]["neigh_fraud_rate"] = float(sum(vals)) if vals else 0.0

    def _build_neighbor_graph(self, terminal_df: pd.DataFrame) -> None:
        coords = terminal_df[["x_terminal_id", "y_terminal_id"]].values
        ids = terminal_df["TERMINAL_ID"].values
        tree = KDTree(coords)
        neighbor_idx = tree.query_ball_point(coords, r=self.neighbor_radius)
        for i, neighs in enumerate(neighbor_idx):
            if not neighs:
                self.terminal_neighbors_[ids[i]] = []
                continue
            w = 1.0 / len(neighs)
            self.terminal_neighbors_[ids[i]] = [(ids[j], w) for j in neighs]

    # ------------------------------------------------------------------ #
    # BATCH transform — full replication of the notebook, used for training
    # ------------------------------------------------------------------ #
    def build_training_frames(self, historical_tx_df: pd.DataFrame):
        """Reproduces notebook 02 end-to-end and returns (train_df, holdout_df, oot_df)
        each containing FEATURE_COLS + TX_FRAUD + TX_FRAUD_SCENARIO + metadata."""
        if not self.is_fitted:
            raise RuntimeError("Call `.fit()` before `build_training_frames()`.")

        df = (
            historical_tx_df.merge(self.customer_profiles_.reset_index(), on="CUSTOMER_ID", how="left")
            .merge(self.terminal_profiles_.reset_index(), on="TERMINAL_ID", how="left")
        )
        df["TX_DATETIME"] = pd.to_datetime(df["TX_DATETIME"])
        df["TX_DAY"] = (df["TX_DATETIME"] - self.t0_).dt.days
        df["hour"] = df["TX_DATETIME"].dt.hour.astype("int8")
        df["is_night"] = df["hour"].isin(NIGHT_HOURS).astype("int8")
        df["day_of_week"] = df["TX_DATETIME"].dt.dayofweek.astype("int8")

        df["distance"] = np.sqrt(
            (df["x_customer_id"] - df["x_terminal_id"]) ** 2
            + (df["y_customer_id"] - df["y_terminal_id"]) ** 2
        ).astype("float32")

        df["Z_score"] = ((df["TX_AMOUNT"] - df["mean_amount"]) / (df["std_amount"] + EPS)).astype("float32")
        df["amount_to_mean_ratio"] = (df["TX_AMOUNT"] / (df["mean_amount"] + EPS)).astype("float32")

        df["spending_tier"] = df["CUSTOMER_ID"].map(self.customer_tier_).astype(str)
        peer_lookup_dict = {str(k): float(v) for k, v in self.peer_mean_lookup_.items()}
        overall_peer_mean = float(np.mean(list(peer_lookup_dict.values()))) if peer_lookup_dict else float(df["TX_AMOUNT"].mean())
        df["peer_mean_amount"] = df["spending_tier"].map(peer_lookup_dict).fillna(overall_peer_mean).astype("float64")
        df["peer_group_amount_ratio"] = (df["TX_AMOUNT"] / (df["peer_mean_amount"] + EPS)).astype("float32")

        df = df.sort_values(["CUSTOMER_ID", "TX_DATETIME"]).reset_index(drop=True)
        df_t = df.set_index("TX_DATETIME")
        df_t["tx_count_1h"] = (
            df_t.groupby("CUSTOMER_ID")["TX_AMOUNT"].transform(lambda x: x.rolling("1h", closed="left").count())
        ).fillna(0).astype("int16")
        df_t["tx_count_4h"] = (
            df_t.groupby("CUSTOMER_ID")["TX_AMOUNT"].transform(lambda x: x.rolling("4h", closed="left").count())
        ).fillna(0).astype("int16")
        df = df_t.reset_index()
        df["night_velocity"] = (df["is_night"] * df["tx_count_1h"]).astype("int16")

        # terminal velocity features
        df = df.sort_values(["TERMINAL_ID", "TX_DATETIME"]).reset_index(drop=True)
        df_t = df.set_index("TX_DATETIME")
        df_t["terminal_tx_count_1h"] = (
            df_t.groupby("TERMINAL_ID")["TX_AMOUNT"].transform(lambda x: x.rolling("1h", closed="left").count())
        ).fillna(0).astype("int16")
        df_t["terminal_tx_count_4h"] = (
            df_t.groupby("TERMINAL_ID")["TX_AMOUNT"].transform(lambda x: x.rolling("4h", closed="left").count())
        ).fillna(0).astype("int16")
        df_t["terminal_distinct_customers_1h"] = (
             df_t.groupby("TERMINAL_ID")["CUSTOMER_ID"].transform(
                 lambda x: x.rolling("1h", closed="left").apply(lambda s: len(np.unique(s)), raw=True)
             )
        ).fillna(0).astype("int16")
        df = df_t.reset_index()

        # terminal fraud rates (fitted lookups already built via fit())
        daily = self.daily_terminal_stats_
        df = df.merge(daily, on=["TERMINAL_ID", "TX_DAY"], how="left")
        for w, col in [(3, "terminal_fraud_rate_3d"), (7, "terminal_fraud_rate_7d"), (28, "terminal_fraud_rate_28d")]:
            pass  # recomputed properly below with full per-day rolling (not just latest day)

        full_grid = pd.MultiIndex.from_product(
            [df["TERMINAL_ID"].unique(), range(int(df["TX_DAY"].min()), int(df["TX_DAY"].max()) + 1)],
            names=["TERMINAL_ID", "TX_DAY"],
        ).to_frame(index=False)
        dstats = full_grid.merge(self.daily_terminal_stats_, on=["TERMINAL_ID", "TX_DAY"], how="left").fillna(0)
        dstats = dstats.sort_values(["TERMINAL_ID", "TX_DAY"]).reset_index(drop=True)
        for term_id, g in dstats.groupby("TERMINAL_ID"):
            idx = g.index
            dstats.loc[idx, "terminal_fraud_rate_3d"] = self._rolling_rate(g["daily_fraud"], g["daily_count"], 3).values
            dstats.loc[idx, "terminal_fraud_rate_7d"] = self._rolling_rate(g["daily_fraud"], g["daily_count"], 7).values
            dstats.loc[idx, "terminal_fraud_rate_28d"] = self._rolling_rate(g["daily_fraud"], g["daily_count"], 28).values
            dstats.loc[idx, "night_fraud_rate"] = self._rolling_rate(g["nightly_fraud"], g["nightly_count"], 7).values

        rate_cols = ["TERMINAL_ID", "TX_DAY", "terminal_fraud_rate_3d", "terminal_fraud_rate_7d",
                     "terminal_fraud_rate_28d", "night_fraud_rate"]
        df = df.drop(columns=["daily_fraud", "daily_count", "nightly_fraud", "nightly_count"], errors="ignore")
        df = df.merge(dstats[rate_cols], on=["TERMINAL_ID", "TX_DAY"], how="left")
        for c in ["terminal_fraud_rate_3d", "terminal_fraud_rate_7d", "terminal_fraud_rate_28d", "night_fraud_rate"]:
            df[c] = df[c].fillna(0).astype("float32")

        # neighborhood fraud rate
        term_day_7d = dstats.set_index(["TERMINAL_ID", "TX_DAY"])["terminal_fraud_rate_7d"]
        def neigh_rate(row):
            neighbors = self.terminal_neighbors_.get(row["TERMINAL_ID"], [])
            if not neighbors:
                return 0.0
            return sum(term_day_7d.get((nid, row["TX_DAY"]), 0.0) * w for nid, w in neighbors)
        df["neigh_fraud_rate"] = df.apply(neigh_rate, axis=1).astype("float32")

        # lag features
        df = df.sort_values(["CUSTOMER_ID", "TX_DATETIME"]).reset_index(drop=True)
        for lag in (1, 2, 3):
            df[f"PREV_TX_AMOUNT_lag{lag}"] = df.groupby("CUSTOMER_ID")["TX_AMOUNT"].shift(lag)
            null_mask = df[f"PREV_TX_AMOUNT_lag{lag}"].isna()
            df.loc[null_mask, f"PREV_TX_AMOUNT_lag{lag}"] = df.loc[null_mask, "mean_amount"]
            df[f"PREV_TX_AMOUNT_lag{lag}"] = df[f"PREV_TX_AMOUNT_lag{lag}"].astype("float32")
            df[f"ratio_to_lag{lag}"] = (df["TX_AMOUNT"] / (df[f"PREV_TX_AMOUNT_lag{lag}"] + EPS)).astype("float32")

        df["is_test_tx_sequence"] = (
            (df["PREV_TX_AMOUNT_lag1"] < SMALL_TX) & (df["TX_AMOUNT"] > LARGE_TX)
        ).astype("int8")

        metadata_cols = ["TRANSACTION_ID", "CUSTOMER_ID", "TERMINAL_ID", "TX_DATETIME", "TX_DAY", "TX_FRAUD_SCENARIO"]
        keep = metadata_cols + FEATURE_COLS + ["TX_FRAUD"]
        train_df = df[df["TX_DAY"] < TRAIN_DAYS][keep].copy()
        test_df = df[df["TX_DAY"] >= TRAIN_DAYS][keep].copy()
        holdout_df = test_df[test_df["TX_DAY"] < HOLDOUT_END_DAY].copy()
        oot_df = test_df[test_df["TX_DAY"] >= HOLDOUT_END_DAY].copy()
        return train_df, holdout_df, oot_df

    # ------------------------------------------------------------------ #
    # ONLINE transform — one new transaction at a time, real-time scoring
    # ------------------------------------------------------------------ #
    def transform(self, tx: dict) -> pd.DataFrame:
        """
        tx must contain: TRANSACTION_ID, CUSTOMER_ID, TERMINAL_ID, TX_DATETIME
        (str or Timestamp), TX_AMOUNT. Returns a single-row DataFrame with
        FEATURE_COLS, ready to feed into the trained model pipelines.

        NOTE: does not mutate realtime state — call `register_realtime_state`
        afterwards once you've decided to accept/process this transaction.
        """
        if not self.is_fitted:
            raise RuntimeError("Feature engineer is not fitted / loaded.")

        cust_id, term_id = tx["CUSTOMER_ID"], tx["TERMINAL_ID"]
        ts = _to_naive_ts(tx["TX_DATETIME"])
        amount = float(tx["TX_AMOUNT"])

        if cust_id not in self.customer_profiles_.index:
            # Brand-new customer (added after training) — don't fail the
            # transaction, bootstrap them with a population-default profile
            # instead. See `register_new_customer` / `is_cold_start`.
            self.register_new_customer(cust_id)
        if term_id not in self.terminal_profiles_.index:
            raise KeyError(f"Unknown TERMINAL_ID {term_id}: no profile on file.")

        cust = self.customer_profiles_.loc[cust_id]
        term = self.terminal_profiles_.loc[term_id]

        hour = int(ts.hour)
        is_night = int(hour in NIGHT_HOURS)
        day_of_week = int(ts.dayofweek)

        distance = float(np.sqrt(
            (cust["x_customer_id"] - term["x_terminal_id"]) ** 2
            + (cust["y_customer_id"] - term["y_terminal_id"]) ** 2
        ))
        z_score = float((amount - cust["mean_amount"]) / (cust["std_amount"] + EPS))
        amount_to_mean_ratio = float(amount / (cust["mean_amount"] + EPS))

        tier = str(self.customer_tier_.get(cust_id))
        peer_lookup_dict = {str(k): float(v) for k, v in self.peer_mean_lookup_.items()}
        peer_mean = peer_lookup_dict.get(tier, amount)
        peer_group_amount_ratio = float(amount / (peer_mean + EPS))

        state = self._customer_state[cust_id]
        tx_count_1h = sum(1 for t in state.recent_tx_times if ts - t < pd.Timedelta(hours=1))
        tx_count_4h = sum(1 for t in state.recent_tx_times if ts - t < pd.Timedelta(hours=4))
        night_velocity = is_night * tx_count_1h

        lags = list(state.last_amounts)  # most-recent-first not guaranteed; fix order below
        # deque appended in chronological order, so last element = most recent (lag1)
        lag_vals = [np.nan, np.nan, np.nan]
        hist = list(state.last_amounts)[::-1]  # most recent first
        for i in range(min(3, len(hist))):
            lag_vals[i] = hist[i]
        for i in range(3):
            if np.isnan(lag_vals[i]):
                lag_vals[i] = cust["mean_amount"]
        lag1, lag2, lag3 = lag_vals
        ratio_to_lag1 = float(amount / (lag1 + EPS))
        ratio_to_lag2 = float(amount / (lag2 + EPS))
        ratio_to_lag3 = float(amount / (lag3 + EPS))
        is_test_tx_sequence = int((lag1 < SMALL_TX) and (amount > LARGE_TX))

        risk = self.terminal_risk_lookup_.get(term_id, {
            "terminal_fraud_rate_3d": 0.0, "terminal_fraud_rate_7d": 0.0,
            "terminal_fraud_rate_28d": 0.0, "night_fraud_rate": 0.0, "neigh_fraud_rate": 0.0,
        })

        t_state = self._terminal_state[term_id]
        terminal_tx_count_1h = sum(1 for t in t_state.recent_tx_times if ts - t < pd.Timedelta(hours=1))
        terminal_tx_count_4h = sum(1 for t in t_state.recent_tx_times if ts - t < pd.Timedelta(hours=4))
        term_customers_1h = set(
            c for t, c in zip(t_state.recent_tx_times, t_state.recent_customers)
            if ts - t < pd.Timedelta(hours=1)
        )
        terminal_distinct_customers_1h = len(term_customers_1h)

        row = {
            "TX_AMOUNT": amount,
            "hour": hour,
            "distance": distance,
            "Z_score": z_score,
            "amount_to_mean_ratio": amount_to_mean_ratio,
            "peer_group_amount_ratio": peer_group_amount_ratio,
            "is_night": is_night,
            "tx_count_1h": tx_count_1h,
            "tx_count_4h": tx_count_4h,
            "night_velocity": night_velocity,
            "terminal_fraud_rate_3d": risk["terminal_fraud_rate_3d"],
            "terminal_fraud_rate_7d": risk["terminal_fraud_rate_7d"],
            "terminal_fraud_rate_28d": risk["terminal_fraud_rate_28d"],
            "night_fraud_rate": risk["night_fraud_rate"],
            "PREV_TX_AMOUNT_lag1": lag1,
            "PREV_TX_AMOUNT_lag2": lag2,
            "PREV_TX_AMOUNT_lag3": lag3,
            "ratio_to_lag1": ratio_to_lag1,
            "ratio_to_lag2": ratio_to_lag2,
            "ratio_to_lag3": ratio_to_lag3,
            "is_test_tx_sequence": is_test_tx_sequence,
            "neigh_fraud_rate": risk.get("neigh_fraud_rate", 0.0),
            "mean_nb_tx_per_day": cust["mean_nb_tx_per_day"],
            "nb_terminals": cust["nb_terminals"],
            "day_of_week": day_of_week,
            "terminal_tx_count_1h": terminal_tx_count_1h,
            "terminal_tx_count_4h": terminal_tx_count_4h,
            "terminal_distinct_customers_1h": terminal_distinct_customers_1h,
        }
        return pd.DataFrame([row], columns=FEATURE_COLS)

    def register_realtime_state(self, tx: dict) -> None:
        """Update per-customer lag/velocity buffers after scoring a transaction.
        Call this once you've decided the transaction is genuinely processed
        (so replay / re-scoring of the same event doesn't double-count)."""
        cust_id = tx["CUSTOMER_ID"]
        term_id = tx["TERMINAL_ID"]
        ts = _to_naive_ts(tx["TX_DATETIME"])
        amount = float(tx["TX_AMOUNT"])
        state = self._customer_state[cust_id]
        state.last_amounts.append(amount)
        state.recent_tx_times.append(ts)
        # prune anything older than 4h (max window we ever look at) to bound memory
        cutoff = ts - pd.Timedelta(hours=4)
        while state.recent_tx_times and state.recent_tx_times[0] < cutoff:
            state.recent_tx_times.popleft()

        t_state = self._terminal_state[term_id]
        t_state.recent_tx_times.append(ts)
        t_state.recent_customers.append(cust_id)
        while t_state.recent_tx_times and t_state.recent_tx_times[0] < cutoff:
            t_state.recent_tx_times.popleft()
            t_state.recent_customers.popleft()

        # --- new-customer cold start: learn their real stats online ------
        # Welford's algorithm — O(1) per transaction, numerically stable,
        # no retraining. Only runs for customers still on a population
        # default; once promoted they're indistinguishable from any other
        # known customer.
        # --- Online baseline maintenance (Welford's algorithm) ---
        state.running_n += 1
        delta = amount - state.running_mean
        state.running_mean += delta / state.running_n
        state.running_m2 += delta * (amount - state.running_mean)

        observed_std = (
            float(np.sqrt(state.running_m2 / (state.running_n - 1)))
            if state.running_n > 1 else float(self.global_defaults_["std_amount"])
        )
        observed_std = observed_std if (observed_std and not np.isnan(observed_std)) else float(self.global_defaults_["std_amount"])

        if cust_id not in self.customer_profiles_.index:
            self.register_new_customer(cust_id)

        self.customer_profiles_.loc[cust_id, "mean_amount"] = round(state.running_mean, 2)
        self.customer_profiles_.loc[cust_id, "std_amount"] = round(observed_std, 2)

        if cust_id in self._cold_start_ids:
            if state.running_n >= self.COLD_START_PROMOTE_AFTER:
                tier = pd.cut(
                    [state.running_mean], bins=self.tier_bins_,
                    labels=self.tier_labels_, include_lowest=True,
                )[0]
                if pd.notna(tier):
                    self.customer_tier_.loc[cust_id] = tier
                self._cold_start_ids.discard(cust_id)
                logger.info(
                    "CUSTOMER_ID=%s promoted out of cold start after %d transactions "
                    "(learned mean_amount=%.2f, std_amount=%.2f).",
                    cust_id, state.running_n, state.running_mean, observed_std,
                )

    # ------------------------------------------------------------------ #
    # Persistence
    # ------------------------------------------------------------------ #
    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: str | Path) -> "FraudFeatureEngineer":
        path = Path(path)
        try:
            with open(path, "rb") as f:
                obj = pickle.load(f)
            if not isinstance(obj, cls):
                raise TypeError(f"{path} does not contain a {cls.__name__}")
            return obj
        except Exception as exc:
            # pandas categorical serialization can break across versions.
            # Fall back to rebuilding the feature engineer from the packaged CSVs.
            fallback_dir = path.parent.parent if path.parent.name == "models" else path.parent
            data_dir = fallback_dir / "full dataset with brief"
            if not data_dir.exists():
                raise RuntimeError(
                    f"Could not load feature engineer from {path} and no fallback data directory was found."
                ) from exc

            import pandas as pd

            customer_df = pd.read_csv(data_dir / "customer_profiles.csv")
            terminal_df = pd.read_csv(data_dir / "terminal_profiles.csv")
            tx_df = pd.read_csv(data_dir / "synthetic_fraud_transactions.csv")
            tx_df["TX_DATETIME"] = pd.to_datetime(tx_df["TX_DATETIME"])

            return cls().fit(customer_df, terminal_df, tx_df)