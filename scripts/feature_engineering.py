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
"""

from __future__ import annotations

import pickle
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Dict, Optional

import numpy as np
import pandas as pd
from scipy.spatial import KDTree

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


@dataclass
class _CustomerState:
    """Rolling, per-customer realtime state used for lag / velocity features."""
    last_amounts: Deque[float] = field(default_factory=lambda: deque(maxlen=3))
    recent_tx_times: Deque[pd.Timestamp] = field(default_factory=lambda: deque(maxlen=2000))

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
        ts = pd.Timestamp(tx["TX_DATETIME"])
        amount = float(tx["TX_AMOUNT"])

        if cust_id not in self.customer_profiles_.index:
            raise KeyError(f"Unknown CUSTOMER_ID {cust_id}: no profile on file.")
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
        ts = pd.Timestamp(tx["TX_DATETIME"])
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
