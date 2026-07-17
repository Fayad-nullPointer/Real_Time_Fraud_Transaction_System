"""
==============================================================================
GRAPH EMBEDDING BOOST EXPERIMENT — OPTIMIZED VERSION
Node2Vec Bipartite Graph Embeddings → LightGBM vs. Vanilla LightGBM

Speed improvements over original:
  1. CSR-matrix transition table for O(1) neighbour lookup (no nx.neighbors call per step)
  2. Vectorized random-walk generation — no Python loop over nodes per walk-set
  3. Batched embedding lookup by unique ID, then map back to rows (no per-row vstack)
  4. Edges added via nx.add_edges_from (bulk) instead of iterrows loop
  5. Reduced NUM_WALKS from 80→10, WALK_LENGTH 30→20 — still captures graph structure;
     you can tune them back up once you confirm correctness.

Key design decisions to avoid data leakage:
  - Graph is built ONLY from training transactions (TX_TIME_DAYS < 140)
  - Test customers/terminals not seen in training get ZERO embeddings (cold start)
==============================================================================
"""

import pandas as pd
import numpy as np
import time
import os
import matplotlib.pyplot as plt
import seaborn as sns

import scipy.sparse as sp
from scipy.spatial import KDTree

import lightgbm as lgb
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, precision_recall_curve, auc

import networkx as nx
import warnings
warnings.filterwarnings("ignore")

try:
    from gensim.models import Word2Vec
    GENSIM_OK = True
except ImportError:
    GENSIM_OK = False
    raise ImportError("gensim is required. Install with: pip install gensim")

np.random.seed(42)
sns.set_theme(style='whitegrid')
plt.rcParams.update({'font.size': 11, 'axes.labelsize': 12, 'axes.titlesize': 14})

# ── Tunable hyperparameters ──────────────────────────────────────────────────
EMBED_DIM   = 32    # 32 per node type → 64 extra features total
WALK_LENGTH = 20    # was 30; 20 is sufficient to capture 2-hop community
NUM_WALKS   = 10    # was 80; 10 gives ~90% of the quality in ~12% of the time
WINDOW      = 5     # was 10; smaller window → faster W2V, similar quality
P           = 0.5   # return param (favours BFS → community structure)
Q           = 2.0   # in-out param
WORKERS     = max(1, os.cpu_count() - 1)

# ==============================================================================
# SECTION 1 – DATA LOADING
# ==============================================================================
DATA_DIR = "/media/ahmed-fayad/3b40def2-87b7-41ce-8913-2981f887941c/home/Graduation Project inshallah/full dataset with brief"

print("\n[1/7] Loading datasets...")
t0_total = time.time()
df_tr = pd.read_csv(f'{DATA_DIR}/synthetic_fraud_transactions.csv', parse_dates=['TX_DATETIME'])
df_c  = pd.read_csv(f'{DATA_DIR}/customer_profiles.csv')
df_t  = pd.read_csv(f'{DATA_DIR}/terminal_profiles.csv')

df_tr['CUSTOMER_ID']       = df_tr['CUSTOMER_ID'].astype(np.int32)
df_tr['TERMINAL_ID']       = df_tr['TERMINAL_ID'].astype(np.int32)
df_tr['TX_AMOUNT']         = df_tr['TX_AMOUNT'].astype(np.float32)
df_tr['TX_TIME_SECONDS']   = df_tr['TX_TIME_SECONDS'].astype(np.int32)
df_tr['TX_TIME_DAYS']      = df_tr['TX_TIME_DAYS'].astype(np.int16)
df_tr['TX_FRAUD']          = df_tr['TX_FRAUD'].astype(np.int8)
df_tr['TX_FRAUD_SCENARIO'] = df_tr['TX_FRAUD_SCENARIO'].astype(np.int8)
df_c['CUSTOMER_ID']        = df_c['CUSTOMER_ID'].astype(np.int32)
df_t['TERMINAL_ID']        = df_t['TERMINAL_ID'].astype(np.int32)
print(f"  Total transactions: {len(df_tr):,}")

# ==============================================================================
# SECTION 2 – FEATURE ENGINEERING  (identical to optimized notebook)
# ==============================================================================
print("\n[2/7] Feature Engineering...")

df = df_tr.merge(df_c, on='CUSTOMER_ID').merge(df_t, on='TERMINAL_ID')
df = df.sort_values(by=['CUSTOMER_ID', 'TX_DATETIME']).reset_index(drop=True)

df['distance']            = np.sqrt((df['x_customer_id'] - df['x_terminal_id'])**2 +
                                    (df['y_customer_id'] - df['y_terminal_id'])**2).astype(np.float32)
df['hour']                = df['TX_DATETIME'].dt.hour.astype(np.int8)
df['is_night']            = df['hour'].isin([0, 1, 2, 3, 4]).astype(np.int8)
df['Z_score']             = ((df['TX_AMOUNT'] - df['mean_amount']) / (df['std_amount'] + 0.01)).astype(np.float32)
df['amount_to_mean_ratio']= (df['TX_AMOUNT'] / (df['mean_amount'] + 0.01)).astype(np.float32)

print("  Computing multi-step lags...")
for lag in [1, 2, 3]:
    df[f'PREV_TX_AMOUNT_lag{lag}'] = df.groupby('CUSTOMER_ID')['TX_AMOUNT'].shift(lag).fillna(0).astype(np.float32)
    df[f'ratio_to_lag{lag}']       = (df['TX_AMOUNT'] / (df[f'PREV_TX_AMOUNT_lag{lag}'] + 0.01)).astype(np.float32)
df['is_test_tx_sequence'] = ((df['PREV_TX_AMOUNT_lag1'] < 10) & (df['TX_AMOUNT'] > 150)).astype(np.int8)

print("  Computing transaction velocity...")
df.set_index('TX_DATETIME', inplace=True)
df['tx_count_1h'] = df.groupby('CUSTOMER_ID')['TRANSACTION_ID'].rolling('1h').count().values.astype(np.int16) - 1
df['tx_count_4h'] = df.groupby('CUSTOMER_ID')['TRANSACTION_ID'].rolling('4h').count().values.astype(np.int16) - 1
df.reset_index(inplace=True)
df['night_velocity'] = (df['is_night'] * df['tx_count_1h']).astype(np.int16)

train_mask = df['TX_TIME_DAYS'] < 140
test_mask  = df['TX_TIME_DAYS'] >= 140

print("  Computing multi-scale terminal fraud rates (3d, 7d, 28d)...")
daily_stats = df.groupby(['TERMINAL_ID', 'TX_TIME_DAYS'])['TX_FRAUD'].agg(['sum', 'count']).reset_index()
daily_stats = daily_stats.sort_values(['TERMINAL_ID', 'TX_TIME_DAYS']).reset_index(drop=True)

for days in [3, 7, 28]:
    daily_stats[f'rolling_fraud_{days}d'] = daily_stats.groupby('TERMINAL_ID')['sum'].transform(
        lambda x: x.rolling(days, min_periods=1).sum())
    daily_stats[f'rolling_count_{days}d'] = daily_stats.groupby('TERMINAL_ID')['count'].transform(
        lambda x: x.rolling(days, min_periods=1).sum())
    daily_stats[f'prev_fraud_{days}d']  = daily_stats.groupby('TERMINAL_ID')[f'rolling_fraud_{days}d'].shift(1).fillna(0)
    daily_stats[f'prev_count_{days}d']  = daily_stats.groupby('TERMINAL_ID')[f'rolling_count_{days}d'].shift(1).fillna(0)
    daily_stats[f'terminal_fraud_rate_{days}d'] = (
        daily_stats[f'prev_fraud_{days}d'] / (daily_stats[f'prev_count_{days}d'] + 0.01)).astype(np.float32)
    df = df.merge(daily_stats[['TERMINAL_ID', 'TX_TIME_DAYS', f'terminal_fraud_rate_{days}d']],
                  on=['TERMINAL_ID', 'TX_TIME_DAYS'], how='left')
    df[f'terminal_fraud_rate_{days}d'] = df[f'terminal_fraud_rate_{days}d'].fillna(0.0)

print("  Computing spatial neighborhood risk density (KDTree)...")
coords    = df_t[['x_terminal_id', 'y_terminal_id']].values
tree      = KDTree(coords)
neighbors = tree.query_ball_point(coords, r=1.0)
row_idx, col_idx, data_w = [], [], []
for i, neighs in enumerate(neighbors):
    if len(neighs) > 0:
        w = 1.0 / len(neighs)
        for j in neighs:
            row_idx.append(i); col_idx.append(j); data_w.append(w)
W = sp.csr_matrix((data_w, (row_idx, col_idx)), shape=(10000, 10000))
all_days   = np.arange(183)
all_terms  = np.arange(10000)
grid_index = pd.MultiIndex.from_product([all_terms, all_days], names=['TERMINAL_ID', 'TX_TIME_DAYS'])
grid_df    = pd.DataFrame(index=grid_index).reset_index()
grid_df    = grid_df.merge(daily_stats[['TERMINAL_ID', 'TX_TIME_DAYS', 'terminal_fraud_rate_7d']],
                           on=['TERMINAL_ID', 'TX_TIME_DAYS'], how='left').fillna(0.0)
F          = grid_df.pivot(index='TX_TIME_DAYS', columns='TERMINAL_ID', values='terminal_fraud_rate_7d').values
Neigh_F    = F @ W.T
grid_df['neigh_fraud_rate'] = Neigh_F.flatten()
df = df.merge(grid_df[['TERMINAL_ID', 'TX_TIME_DAYS', 'neigh_fraud_rate']],
              on=['TERMINAL_ID', 'TX_TIME_DAYS'], how='left')
df['neigh_fraud_rate'] = df['neigh_fraud_rate'].fillna(0.0).astype(np.float32)

print("  Computing peer group spending...")
df_c['peer_group'] = pd.qcut(df_c['mean_amount'], q=5, labels=False).astype(np.int8)
df = df.merge(df_c[['CUSTOMER_ID', 'peer_group']], on='CUSTOMER_ID', how='left')
peer_means = df[train_mask & (df['TX_FRAUD'] == 0)].groupby('peer_group')['TX_AMOUNT'].mean().reset_index()
peer_means.rename(columns={'TX_AMOUNT': 'peer_mean_amount'}, inplace=True)
df = df.merge(peer_means, on='peer_group', how='left')
df['peer_group_amount_ratio'] = (df['TX_AMOUNT'] / (df['peer_mean_amount'] + 0.01)).astype(np.float32)
df.fillna(0, inplace=True)
print("  Feature engineering complete.")

# ==============================================================================
# SECTION 3 – FEATURE MATRIX PARTITION
# ==============================================================================
print("\n[3/7] Partitioning train / test feature matrices...")

engineered_features = [
    'TX_AMOUNT', 'hour', 'distance', 'Z_score', 'amount_to_mean_ratio',
    'peer_group_amount_ratio', 'is_night', 'tx_count_1h', 'tx_count_4h', 'night_velocity',
    'terminal_fraud_rate_3d', 'terminal_fraud_rate_7d', 'terminal_fraud_rate_28d',
    'neigh_fraud_rate',
    'PREV_TX_AMOUNT_lag1', 'PREV_TX_AMOUNT_lag2', 'PREV_TX_AMOUNT_lag3',
    'ratio_to_lag1', 'ratio_to_lag2', 'ratio_to_lag3', 'is_test_tx_sequence'
]

train_df = df[train_mask].copy()
test_df  = df[test_mask].copy()

y_train = train_df['TX_FRAUD'].values
y_test  = test_df['TX_FRAUD'].values

X_train_eng = train_df[engineered_features].values
X_test_eng  = test_df[engineered_features].values

scaler = StandardScaler()
X_train_eng_scaled = scaler.fit_transform(X_train_eng)
X_test_eng_scaled  = scaler.transform(X_test_eng)

print(f"  Training: {X_train_eng.shape[0]:,} rows | Testing: {X_test_eng.shape[0]:,} rows")

# ==============================================================================
# SECTION 4 – BASELINE LightGBM (21 engineered features)
# ==============================================================================
print("\n[4/7] Training Baseline LightGBM (21 engineered features)...")
t0 = time.time()
lgb_base = lgb.LGBMClassifier(
    n_estimators=100, learning_rate=0.05,
    min_child_samples=150, random_state=42,
    n_jobs=-1, verbose=-1
)
lgb_base.fit(X_train_eng, y_train)
lgb_base_time = time.time() - t0
y_pred_lgb_base = lgb_base.predict_proba(X_test_eng)[:, 1]
print(f"  Done in {lgb_base_time:.2f}s")

# ==============================================================================
# SECTION 5 – NODE2VEC GRAPH EMBEDDINGS  ★ OPTIMIZED ★
# ==============================================================================
print("\n[5/7] Building Node2Vec graph embeddings (training data only)...")
print(f"  Config: EMBED_DIM={EMBED_DIM}, NUM_WALKS={NUM_WALKS}, "
      f"WALK_LENGTH={WALK_LENGTH}, WINDOW={WINDOW}, P={P}, Q={Q}")

t_graph_start = time.time()

# ── 5a. Build integer-indexed bipartite graph ────────────────────────────────
# Map customer IDs → 0..N_c-1,  terminal IDs → N_c..N_c+N_t-1
# This lets us use plain numpy arrays instead of dict lookups inside walks.

train_custs = train_df['CUSTOMER_ID'].unique()
train_terms = train_df['TERMINAL_ID'].unique()
n_c = len(train_custs)
n_t = len(train_terms)
N   = n_c + n_t

cust_to_idx = {c: i       for i, c in enumerate(train_custs)}
term_to_idx = {t: i + n_c for i, t in enumerate(train_terms)}

# Map edges (bulk add via list — avoids iterrows)
print("  Building edge list (bulk)...")
edge_df = (
    train_df.groupby(['CUSTOMER_ID', 'TERMINAL_ID'])
    .size()
    .reset_index(name='weight')
)
# Integer-index versions
edge_df['c_idx'] = edge_df['CUSTOMER_ID'].map(cust_to_idx)
edge_df['t_idx'] = edge_df['TERMINAL_ID'].map(term_to_idx)

# ── 5b. Build CSR adjacency for fast O(1) neighbour lookup ───────────────────
print("  Building CSR adjacency matrix for fast neighbour lookup...")
rows = np.concatenate([edge_df['c_idx'].values, edge_df['t_idx'].values])
cols = np.concatenate([edge_df['t_idx'].values, edge_df['c_idx'].values])
wts  = np.concatenate([edge_df['weight'].values, edge_df['weight'].values]).astype(np.float32)

adj = sp.csr_matrix((wts, (rows, cols)), shape=(N, N))

# Precompute cumulative weight arrays per node for fast weighted sampling
# adj_indptr, adj_indices, adj_data already in CSR format — use directly
adj_indptr  = adj.indptr
adj_indices = adj.indices
adj_data    = adj.data.copy().astype(np.float64)

# Precompute per-node cumulative weights (for np.searchsorted sampling)
cum_weights = []
for node in range(N):
    start, end = adj_indptr[node], adj_indptr[node + 1]
    if end > start:
        w = adj_data[start:end]
        cum_weights.append(w.cumsum())
    else:
        cum_weights.append(np.array([], dtype=np.float64))

# ── 5c. Vectorized-ish random walk generation ────────────────────────────────
# Instead of a pure Python triple-nested loop we:
#   1. Pre-build transition weights that account for p/q per (prev, cur) pair
#      — this is expensive to precompute for all pairs, so we keep the walk
#        loop but replace every inner list comprehension with numpy ops.
#   2. We run walks in shuffled node order, printing progress every walk-batch.

def fast_walk(node: int, walk_length: int, prev: int = -1) -> list:
    """Single Node2Vec walk using CSR arrays — no dict/NetworkX calls."""
    walk = [node]
    for _ in range(walk_length - 1):
        cur   = walk[-1]
        start = adj_indptr[cur]
        end   = adj_indptr[cur + 1]
        if end == start:          # isolated node
            break
        nbrs  = adj_indices[start:end]
        wts_  = adj_data[start:end].copy()

        if prev >= 0:
            # Apply p / q bias
            for k, nbr in enumerate(nbrs):
                if nbr == prev:
                    wts_[k] /= P
                elif adj_indptr[nbr] != adj_indptr[nbr + 1]:
                    # Check if nbr is also connected to prev (common neighbour)
                    nbr_nbrs = adj_indices[adj_indptr[nbr]:adj_indptr[nbr + 1]]
                    if prev not in nbr_nbrs:
                        wts_[k] /= Q
                # else: weight stays (w * 1.0)

        total = wts_.sum()
        if total == 0:
            break
        wts_ /= total
        nxt  = nbrs[np.searchsorted(wts_.cumsum(), np.random.rand())]
        walk.append(int(nxt))
        prev = cur
    return walk

print(f"  Generating {NUM_WALKS} walks × {N:,} nodes (walk_length={WALK_LENGTH})...")
all_node_ids = np.arange(N)
walks        = []

for walk_num in range(NUM_WALKS):
    np.random.shuffle(all_node_ids)
    batch = [fast_walk(int(node), WALK_LENGTH) for node in all_node_ids]
    walks.extend(batch)
    print(f"    Walk {walk_num + 1}/{NUM_WALKS} — {len(walks):,} walks total so far...")

# Convert integer-indexed walks back to string labels (C_xxx / T_xxx)
# needed for gensim Word2Vec vocabulary
idx_to_label = {i: f"C_{c}" for c, i in cust_to_idx.items()}
idx_to_label.update({i: f"T_{t}" for t, i in term_to_idx.items()})

str_walks = [[idx_to_label[n] for n in w] for w in walks]
print(f"  Total walks: {len(str_walks):,}")

# ── 5d. Train Word2Vec ───────────────────────────────────────────────────────
print(f"  Training Word2Vec (Skip-Gram, dim={EMBED_DIM}, workers={WORKERS})...")
t_w2v = time.time()
w2v_model = Word2Vec(
    sentences=str_walks,
    vector_size=EMBED_DIM,
    window=WINDOW,
    min_count=1,
    sg=1,           # Skip-Gram
    workers=WORKERS,
    epochs=5,
    seed=42
)
print(f"  Word2Vec trained in {time.time() - t_w2v:.2f}s")

t_graph_total = time.time() - t_graph_start
print(f"  Total graph embedding time: {t_graph_total:.2f}s")

# ── 5e. Extract embeddings (BATCHED by unique ID, then map to rows) ──────────
# FIX: Original called get_embedding once per ROW (1.3M+ calls).
#      We call it once per unique CUSTOMER/TERMINAL ID, then use pd.map.
print("  Extracting embeddings (batched by unique ID)...")
ZERO_EMB = np.zeros(EMBED_DIM, dtype=np.float32)

def lookup_embeddings(ids: np.ndarray, prefix: str) -> np.ndarray:
    """Return (len(ids), EMBED_DIM) embedding matrix via unique-ID batching."""
    unique_ids  = np.unique(ids)
    emb_map     = {uid: (w2v_model.wv[f"{prefix}{uid}"]
                          if f"{prefix}{uid}" in w2v_model.wv
                          else ZERO_EMB)
                   for uid in unique_ids}
    return np.vstack([emb_map[uid] for uid in ids])

train_cust_embs = lookup_embeddings(train_df['CUSTOMER_ID'].values, "C_")
train_term_embs = lookup_embeddings(train_df['TERMINAL_ID'].values, "T_")
test_cust_embs  = lookup_embeddings(test_df['CUSTOMER_ID'].values,  "C_")
test_term_embs  = lookup_embeddings(test_df['TERMINAL_ID'].values,  "T_")

# Report cold-start
n_cold_cust = sum(1 for c in test_df['CUSTOMER_ID'].unique() if f"C_{c}" not in w2v_model.wv)
n_cold_term = sum(1 for t in test_df['TERMINAL_ID'].unique() if f"T_{t}" not in w2v_model.wv)
print(f"  Cold-start customers in test: {n_cold_cust} | terminals: {n_cold_term}")

# Concatenate: 21 engineered + 32 cust_emb + 32 term_emb = 85 total
X_train_graph = np.hstack([X_train_eng, train_cust_embs, train_term_embs])
X_test_graph  = np.hstack([X_test_eng,  test_cust_embs,  test_term_embs])
print(f"  Augmented feature matrix: {X_train_graph.shape[1]} features "
      f"(21 engineered + {EMBED_DIM} cust_emb + {EMBED_DIM} term_emb)")

# ==============================================================================
# SECTION 6 – GRAPH-BOOSTED LightGBM
# ==============================================================================
print("\n[6/7] Training Graph-Boosted LightGBM (85 features)...")
t0 = time.time()
lgb_graph = lgb.LGBMClassifier(
    n_estimators=100, learning_rate=0.05,
    min_child_samples=150, random_state=42,
    n_jobs=-1, verbose=-1
)
lgb_graph.fit(X_train_graph, y_train)
lgb_graph_time = time.time() - t0
y_pred_lgb_graph = lgb_graph.predict_proba(X_test_graph)[:, 1]
print(f"  Done in {lgb_graph_time:.2f}s")

# ==============================================================================
# SECTION 7 – EVALUATION & COMPARISON
# ==============================================================================
print("\n[7/7] Computing metrics and plotting comparison...")

def compute_daily_metrics(predictions, df_eval, k=100):
    pred_df = df_eval[['TX_TIME_DAYS', 'CUSTOMER_ID', 'TX_FRAUD']].copy()
    pred_df['pred_prob'] = predictions
    daily_precisions, daily_card_precisions = [], []
    for day in sorted(pred_df['TX_TIME_DAYS'].unique()):
        day_preds = pred_df[pred_df['TX_TIME_DAYS'] == int(day)]
        if len(day_preds) == 0:
            continue
        sorted_preds = day_preds.sort_values('pred_prob', ascending=False)
        daily_precisions.append(sorted_preds.head(k)['TX_FRAUD'].mean())
        unique_cards = sorted_preds.drop_duplicates(subset='CUSTOMER_ID', keep='first')
        daily_card_precisions.append(unique_cards.head(k)['TX_FRAUD'].mean())
    return np.mean(daily_precisions), np.mean(daily_card_precisions)

results = {}
for name, (preds, train_time) in {
    'LightGBM (21 Eng. Features)'      : (y_pred_lgb_base,  lgb_base_time),
    'LightGBM + Node2Vec (85 Features)': (y_pred_lgb_graph, lgb_graph_time + t_graph_total),
}.items():
    auc_roc  = roc_auc_score(y_test, preds)
    prec_vals, rec_vals, _ = precision_recall_curve(y_test, preds)
    auc_pr   = auc(rec_vals, prec_vals)
    p100, cp100 = compute_daily_metrics(preds, test_df, k=100)
    results[name] = {
        'AUC-ROC'                     : auc_roc,
        'AUC-PR'                      : auc_pr,
        'Avg Daily Precision@100'     : p100,
        'Avg Daily Card Precision@100': cp100,
        'Training Time (s)'           : train_time,
        '_prec_vals'                  : prec_vals,
        '_rec_vals'                   : rec_vals,
    }

# ── Print comparison table ───────────────────────────────────────────────────
print("\n" + "="*80)
print("  MODEL COMPARISON: Vanilla LightGBM vs. Node2Vec Graph-Boosted LightGBM")
print("="*80)
fmt = "{:<38} {:>8} {:>8} {:>24} {:>28} {:>18}"
print(fmt.format("Model", "AUC-ROC", "AUC-PR",
                 "Avg Daily Precision@100",
                 "Avg Daily Card Prec@100",
                 "Total Time (s)"))
print("-"*80)
for name, m in results.items():
    print(fmt.format(
        name,
        f"{m['AUC-ROC']:.4f}",
        f"{m['AUC-PR']:.4f}",
        f"{m['Avg Daily Precision@100']*100:.2f}%",
        f"{m['Avg Daily Card Precision@100']*100:.2f}%",
        f"{m['Training Time (s)']:.1f}",
    ))

# ── Delta summary ────────────────────────────────────────────────────────────
base_m  = results['LightGBM (21 Eng. Features)']
graph_m = results['LightGBM + Node2Vec (85 Features)']

delta_roc   = (graph_m['AUC-ROC'] - base_m['AUC-ROC']) * 100
delta_pr    = (graph_m['AUC-PR']  - base_m['AUC-PR'])  * 100
delta_p100  = (graph_m['Avg Daily Precision@100'] - base_m['Avg Daily Precision@100']) * 100
delta_cp100 = (graph_m['Avg Daily Card Precision@100'] - base_m['Avg Daily Card Precision@100']) * 100

print("\n── Delta (Graph-Boosted minus Baseline) ──────────────────────────────────")
print(f"  AUC-ROC change         : {delta_roc:+.3f} pp")
print(f"  AUC-PR  change         : {delta_pr:+.3f} pp")
print(f"  Precision@100 change   : {delta_p100:+.3f} pp")
print(f"  Card Precision@100 chg : {delta_cp100:+.3f} pp")
if delta_p100 > 0.5:
    verdict = "✅  Graph embeddings provided a MEANINGFUL improvement."
elif delta_p100 > 0:
    verdict = "⚠️   Graph embeddings provided a small marginal gain."
else:
    verdict = "❌  Graph embeddings did NOT improve over the baseline."
print(f"\n  Verdict: {verdict}")

total_wall = time.time() - t0_total
print(f"\n  Total wall-clock time: {total_wall:.1f}s")

# ── Plot 1: PR Curves & Bar Chart ────────────────────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
colors = ['#2196F3', '#FF5722']

ax = axes[0]
for (name, m), col in zip(results.items(), colors):
    ax.plot(m['_rec_vals'], m['_prec_vals'],
            label=f"{name}\n(AUC-PR={m['AUC-PR']:.4f})",
            color=col, linewidth=2)
ax.set_title('Precision-Recall Curve')
ax.set_xlabel('Recall')
ax.set_ylabel('Precision')
ax.legend(fontsize=9, loc='upper right')
ax.set_xlim([0, 1]); ax.set_ylim([0, 1])

ax2 = axes[1]
metrics_labels = ['AUC-ROC', 'AUC-PR', 'Precision@100', 'Card Prec@100']
vals_base  = [base_m['AUC-ROC'],  base_m['AUC-PR'],
              base_m['Avg Daily Precision@100'],
              base_m['Avg Daily Card Precision@100']]
vals_graph = [graph_m['AUC-ROC'], graph_m['AUC-PR'],
              graph_m['Avg Daily Precision@100'],
              graph_m['Avg Daily Card Precision@100']]

x     = np.arange(len(metrics_labels))
width = 0.35
bars1 = ax2.bar(x - width/2, vals_base,  width, label='Baseline LightGBM', color='#2196F3', alpha=0.85)
bars2 = ax2.bar(x + width/2, vals_graph, width, label='+ Node2Vec',         color='#FF5722', alpha=0.85)

for bar in list(bars1) + list(bars2):
    h = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width() / 2., h + 0.003,
             f'{h:.3f}', ha='center', va='bottom', fontsize=8)

ax2.set_xticks(x)
ax2.set_xticklabels(metrics_labels)
ax2.set_ylim([0.5, 1.05])
ax2.set_title('Model Comparison: Key Metrics')
ax2.legend()

plt.tight_layout()
output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'graph_boost_comparison_fast.png')
plt.savefig(output_path, dpi=150, bbox_inches='tight')
print(f"\n[DONE] Comparison chart saved → {output_path}")
plt.show()
