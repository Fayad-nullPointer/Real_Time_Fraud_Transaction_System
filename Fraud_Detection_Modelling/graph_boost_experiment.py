"""
==============================================================================
GRAPH EMBEDDING BOOST EXPERIMENT
Node2Vec Bipartite Graph Embeddings → LightGBM vs. Vanilla LightGBM

Compares:
  Model A: LightGBM with 21 Engineered Features (baseline from optimized notebook)
  Model B: LightGBM with 21 Engineered Features + 64-dim Node2Vec graph embeddings

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

# ── Try importing node2vec; fall back to pecanpy or manual ──────────────────
try:
    from node2vec import Node2Vec as _Node2Vec
    BACKEND = "node2vec"
    print("[INFO] Using 'node2vec' library backend.")
except ImportError:
    try:
        import pecanpy
        BACKEND = "pecanpy"
        print("[INFO] Using 'pecanpy' library backend.")
    except ImportError:
        BACKEND = "manual"
        print("[INFO] Neither node2vec nor pecanpy found – using manual random-walk + gensim.")

try:
    from gensim.models import Word2Vec
    GENSIM_OK = True
except ImportError:
    GENSIM_OK = False
    print("[WARNING] gensim not found – manual walk backend unavailable.")

np.random.seed(42)

# ── Plotting setup ───────────────────────────────────────────────────────────
sns.set_theme(style='whitegrid')
plt.rcParams.update({'font.size': 11, 'axes.labelsize': 12, 'axes.titlesize': 14})

# ==============================================================================
# SECTION 1 – DATA LOADING  (same paths as optimized notebook)
# ==============================================================================
DATA_DIR = "/media/ahmed-fayad/3b40def2-87b7-41ce-8913-2981f887941c/home/Graduation Project inshallah/full dataset with brief"

print("\n[1/7] Loading datasets...")
df_tr = pd.read_csv(f'{DATA_DIR}/synthetic_fraud_transactions.csv', parse_dates=['TX_DATETIME'])
df_c  = pd.read_csv(f'{DATA_DIR}/customer_profiles.csv')
df_t  = pd.read_csv(f'{DATA_DIR}/terminal_profiles.csv')

# Downcast for memory
df_tr['CUSTOMER_ID']      = df_tr['CUSTOMER_ID'].astype(np.int32)
df_tr['TERMINAL_ID']      = df_tr['TERMINAL_ID'].astype(np.int32)
df_tr['TX_AMOUNT']        = df_tr['TX_AMOUNT'].astype(np.float32)
df_tr['TX_TIME_SECONDS']  = df_tr['TX_TIME_SECONDS'].astype(np.int32)
df_tr['TX_TIME_DAYS']     = df_tr['TX_TIME_DAYS'].astype(np.int16)
df_tr['TX_FRAUD']         = df_tr['TX_FRAUD'].astype(np.int8)
df_tr['TX_FRAUD_SCENARIO']= df_tr['TX_FRAUD_SCENARIO'].astype(np.int8)
df_c['CUSTOMER_ID']       = df_c['CUSTOMER_ID'].astype(np.int32)
df_t['TERMINAL_ID']       = df_t['TERMINAL_ID'].astype(np.int32)
print(f"  Total transactions: {len(df_tr):,}")

# ==============================================================================
# SECTION 2 – FEATURE ENGINEERING  (identical to optimized notebook)
# ==============================================================================
print("\n[2/7] Feature Engineering (mirrors optimized notebook)...")

df = df_tr.merge(df_c, on='CUSTOMER_ID').merge(df_t, on='TERMINAL_ID')
df = df.sort_values(by=['CUSTOMER_ID', 'TX_DATETIME']).reset_index(drop=True)

df['distance']           = np.sqrt((df['x_customer_id']-df['x_terminal_id'])**2 +
                                   (df['y_customer_id']-df['y_terminal_id'])**2).astype(np.float32)
df['hour']               = df['TX_DATETIME'].dt.hour.astype(np.int8)
df['is_night']           = df['hour'].isin([0,1,2,3,4]).astype(np.int8)
df['Z_score']            = ((df['TX_AMOUNT']-df['mean_amount'])/(df['std_amount']+0.01)).astype(np.float32)
df['amount_to_mean_ratio']= (df['TX_AMOUNT']/(df['mean_amount']+0.01)).astype(np.float32)

print("  Computing multi-step lags...")
df['PREV_TX_AMOUNT_lag1'] = df.groupby('CUSTOMER_ID')['TX_AMOUNT'].shift(1).fillna(0).astype(np.float32)
df['PREV_TX_AMOUNT_lag2'] = df.groupby('CUSTOMER_ID')['TX_AMOUNT'].shift(2).fillna(0).astype(np.float32)
df['PREV_TX_AMOUNT_lag3'] = df.groupby('CUSTOMER_ID')['TX_AMOUNT'].shift(3).fillna(0).astype(np.float32)
df['ratio_to_lag1']       = (df['TX_AMOUNT']/(df['PREV_TX_AMOUNT_lag1']+0.01)).astype(np.float32)
df['ratio_to_lag2']       = (df['TX_AMOUNT']/(df['PREV_TX_AMOUNT_lag2']+0.01)).astype(np.float32)
df['ratio_to_lag3']       = (df['TX_AMOUNT']/(df['PREV_TX_AMOUNT_lag3']+0.01)).astype(np.float32)
df['is_test_tx_sequence'] = ((df['PREV_TX_AMOUNT_lag1']<10) & (df['TX_AMOUNT']>150)).astype(np.int8)

print("  Computing transaction velocity...")
df.set_index('TX_DATETIME', inplace=True)
df['tx_count_1h'] = df.groupby('CUSTOMER_ID')['TRANSACTION_ID'].rolling('1h').count().values.astype(np.int16) - 1
df['tx_count_4h'] = df.groupby('CUSTOMER_ID')['TRANSACTION_ID'].rolling('4h').count().values.astype(np.int16) - 1
df.reset_index(inplace=True)
df['night_velocity'] = (df['is_night'] * df['tx_count_1h']).astype(np.int16)

train_mask = df['TX_TIME_DAYS'] < 140
test_mask  = df['TX_TIME_DAYS'] >= 140

print("  Computing multi-scale terminal fraud rates (3d, 7d, 28d)...")
daily_stats = df.groupby(['TERMINAL_ID','TX_TIME_DAYS'])['TX_FRAUD'].agg(['sum','count']).reset_index()
daily_stats = daily_stats.sort_values(by=['TERMINAL_ID','TX_TIME_DAYS']).reset_index(drop=True)

for days in [3, 7, 28]:
    daily_stats[f'rolling_fraud_{days}d'] = daily_stats.groupby('TERMINAL_ID')['sum'].transform(
        lambda x: x.rolling(days, min_periods=1).sum())
    daily_stats[f'rolling_count_{days}d'] = daily_stats.groupby('TERMINAL_ID')['count'].transform(
        lambda x: x.rolling(days, min_periods=1).sum())
    daily_stats[f'prev_fraud_{days}d'] = daily_stats.groupby('TERMINAL_ID')[f'rolling_fraud_{days}d'].shift(1).fillna(0)
    daily_stats[f'prev_count_{days}d'] = daily_stats.groupby('TERMINAL_ID')[f'rolling_count_{days}d'].shift(1).fillna(0)
    daily_stats[f'terminal_fraud_rate_{days}d'] = (
        daily_stats[f'prev_fraud_{days}d'] / (daily_stats[f'prev_count_{days}d']+0.01)).astype(np.float32)
    df = df.merge(daily_stats[['TERMINAL_ID','TX_TIME_DAYS',f'terminal_fraud_rate_{days}d']],
                  on=['TERMINAL_ID','TX_TIME_DAYS'], how='left')
    df[f'terminal_fraud_rate_{days}d'] = df[f'terminal_fraud_rate_{days}d'].fillna(0.0)

print("  Computing spatial neighborhood risk density (KDTree)...")
coords    = df_t[['x_terminal_id','y_terminal_id']].values
tree      = KDTree(coords)
neighbors = tree.query_ball_point(coords, r=1.0)
row_idx, col_idx, data_w = [], [], []
for i, neighs in enumerate(neighbors):
    if len(neighs) > 0:
        w = 1.0 / len(neighs)
        for j in neighs:
            row_idx.append(i); col_idx.append(j); data_w.append(w)
W = sp.csr_matrix((data_w, (row_idx, col_idx)), shape=(10000, 10000))
all_days  = np.arange(183); all_terms = np.arange(10000)
grid_index = pd.MultiIndex.from_product([all_terms, all_days], names=['TERMINAL_ID','TX_TIME_DAYS'])
grid_df   = pd.DataFrame(index=grid_index).reset_index()
grid_df   = grid_df.merge(daily_stats[['TERMINAL_ID','TX_TIME_DAYS','terminal_fraud_rate_7d']],
                          on=['TERMINAL_ID','TX_TIME_DAYS'], how='left').fillna(0.0)
F         = grid_df.pivot(index='TX_TIME_DAYS', columns='TERMINAL_ID',
                          values='terminal_fraud_rate_7d').values
Neigh_F   = F @ W.T
grid_df['neigh_fraud_rate'] = Neigh_F.flatten()
df = df.merge(grid_df[['TERMINAL_ID','TX_TIME_DAYS','neigh_fraud_rate']],
              on=['TERMINAL_ID','TX_TIME_DAYS'], how='left')
df['neigh_fraud_rate'] = df['neigh_fraud_rate'].fillna(0.0).astype(np.float32)

print("  Computing peer group spending...")
df_c['peer_group'] = pd.qcut(df_c['mean_amount'], q=5, labels=False).astype(np.int8)
df = df.merge(df_c[['CUSTOMER_ID','peer_group']], on='CUSTOMER_ID', how='left')
peer_means = df[train_mask & (df['TX_FRAUD']==0)].groupby('peer_group')['TX_AMOUNT'].mean().reset_index()
peer_means.rename(columns={'TX_AMOUNT':'peer_mean_amount'}, inplace=True)
df = df.merge(peer_means, on='peer_group', how='left')
df['peer_group_amount_ratio'] = (df['TX_AMOUNT']/(df['peer_mean_amount']+0.01)).astype(np.float32)
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

train_df = df[train_mask]
test_df  = df[test_mask]

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
    n_estimators=100,
    learning_rate=0.05,
    min_child_samples=150,
    random_state=42,
    n_jobs=-1,
    verbose=-1
)
lgb_base.fit(X_train_eng, y_train)
lgb_base_time = time.time() - t0
y_pred_lgb_base = lgb_base.predict_proba(X_test_eng)[:, 1]
print(f"  Done in {lgb_base_time:.2f}s")

# ==============================================================================
# SECTION 5 – NODE2VEC GRAPH EMBEDDINGS (training data only)
# ==============================================================================
print("\n[5/7] Building Node2Vec graph embeddings (training data only)...")

EMBED_DIM   = 32   # 32 per node type → 64 extra features total
WALK_LENGTH = 30
NUM_WALKS   = 80   # kept moderate for speed
WINDOW      = 10
WORKERS     = max(1, os.cpu_count() - 1)

# ── Build bipartite graph from TRAINING transactions ─────────────────────────
t_graph_start = time.time()

# Prefix nodes to separate customer vs terminal space
cust_nodes = {c: f"C_{c}" for c in train_df['CUSTOMER_ID'].unique()}
term_nodes = {t: f"T_{t}" for t in train_df['TERMINAL_ID'].unique()}

print("  Building NetworkX bipartite graph...")
G = nx.Graph()
G.add_nodes_from(cust_nodes.values(), bipartite='customer')
G.add_nodes_from(term_nodes.values(), bipartite='terminal')

# Weight edges by number of transactions between customer-terminal pair
edge_weights = (
    train_df.groupby(['CUSTOMER_ID', 'TERMINAL_ID'])
    .size()
    .reset_index(name='weight')
)
for _, row in edge_weights.iterrows():
    G.add_edge(f"C_{int(row['CUSTOMER_ID'])}",
               f"T_{int(row['TERMINAL_ID'])}",
               weight=float(row['weight']))

print(f"  Graph: {G.number_of_nodes():,} nodes, {G.number_of_edges():,} edges")

# ── Manual random walks (avoids hard dependency on node2vec library) ─────────
def biased_random_walk(G, start_node, walk_length, p=1.0, q=1.0):
    """Node2Vec-style random walk. p=return, q=in-out parameter."""
    walk = [start_node]
    prev = None
    for _ in range(walk_length - 1):
        cur = walk[-1]
        neighbors = list(G.neighbors(cur))
        if len(neighbors) == 0:
            break
        weights = []
        for nbr in neighbors:
            w = G[cur][nbr].get('weight', 1.0)
            if prev is None:
                weights.append(w)
            elif nbr == prev:
                weights.append(w / p)
            elif G.has_edge(nbr, prev):
                weights.append(w)
            else:
                weights.append(w / q)
        weights = np.array(weights, dtype=np.float64)
        weights /= weights.sum()
        next_node = np.random.choice(neighbors, p=weights)
        walk.append(next_node)
        prev = cur
    return walk

# Node2Vec hyperparameters (p < 1 favours BFS → community structure)
P = 0.5   # return param
Q = 2.0   # in-out param

print(f"  Generating {NUM_WALKS} random walks per node (walk_length={WALK_LENGTH}, p={P}, q={Q})...")
all_nodes = list(G.nodes())
walks = []
for walk_num in range(NUM_WALKS):
    np.random.shuffle(all_nodes)
    for node in all_nodes:
        walk = biased_random_walk(G, node, WALK_LENGTH, p=P, q=Q)
        walks.append(walk)
    if (walk_num + 1) % 10 == 0:
        print(f"    Walk {walk_num+1}/{NUM_WALKS} complete...")

print(f"  Total walks generated: {len(walks):,}")

# ── Train Word2Vec (Skip-Gram) on walks ─────────────────────────────────────
if not GENSIM_OK:
    raise ImportError("gensim is required for manual walk backend. Install with: pip install gensim")

print(f"  Training Word2Vec (Skip-Gram) on walks, dim={EMBED_DIM}...")
t_w2v = time.time()
w2v_model = Word2Vec(
    sentences=walks,
    vector_size=EMBED_DIM,
    window=WINDOW,
    min_count=1,
    sg=1,           # Skip-Gram
    workers=WORKERS,
    epochs=5,
    seed=42
)
print(f"  Word2Vec trained in {time.time()-t_w2v:.2f}s")

t_graph_total = time.time() - t_graph_start
print(f"  Total graph embedding time: {t_graph_total:.2f}s")

# ── Extract embeddings ───────────────────────────────────────────────────────
def get_embedding(node_key, model, dim):
    if node_key in model.wv:
        return model.wv[node_key]
    return np.zeros(dim, dtype=np.float32)   # cold-start fallback

print("  Extracting embeddings for train/test rows...")
train_cust_embs = np.vstack([
    get_embedding(f"C_{c}", w2v_model, EMBED_DIM)
    for c in train_df['CUSTOMER_ID'].values
])
train_term_embs = np.vstack([
    get_embedding(f"T_{t}", w2v_model, EMBED_DIM)
    for t in train_df['TERMINAL_ID'].values
])
test_cust_embs = np.vstack([
    get_embedding(f"C_{c}", w2v_model, EMBED_DIM)
    for c in test_df['CUSTOMER_ID'].values
])
test_term_embs = np.vstack([
    get_embedding(f"T_{t}", w2v_model, EMBED_DIM)
    for t in test_df['TERMINAL_ID'].values
])

# Concatenate: 21 engineered + 32 customer_emb + 32 terminal_emb = 85 total
X_train_graph = np.hstack([X_train_eng, train_cust_embs, train_term_embs])
X_test_graph  = np.hstack([X_test_eng,  test_cust_embs,  test_term_embs])

# Count cold-start nodes in test
n_cold_cust = sum(1 for c in test_df['CUSTOMER_ID'].unique()
                  if f"C_{c}" not in w2v_model.wv)
n_cold_term = sum(1 for t in test_df['TERMINAL_ID'].unique()
                  if f"T_{t}" not in w2v_model.wv)
print(f"  Cold-start customers in test: {n_cold_cust} | terminals: {n_cold_term}")
print(f"  Augmented feature matrix: {X_train_graph.shape[1]} features "
      f"(21 engineered + {EMBED_DIM} cust_emb + {EMBED_DIM} term_emb)")

# ==============================================================================
# SECTION 6 – GRAPH-BOOSTED LightGBM (21 + 64 graph features)
# ==============================================================================
print("\n[6/7] Training Graph-Boosted LightGBM (85 features)...")
t0 = time.time()
lgb_graph = lgb.LGBMClassifier(
    n_estimators=100,
    learning_rate=0.05,
    min_child_samples=150,
    random_state=42,
    n_jobs=-1,
    verbose=-1
)
lgb_graph.fit(X_train_graph, y_train)
lgb_graph_time = time.time() - t0
y_pred_lgb_graph = lgb_graph.predict_proba(X_test_graph)[:, 1]
print(f"  Done in {lgb_graph_time:.2f}s")

# ==============================================================================
# SECTION 7 – EVALUATION & COMPARISON
# ==============================================================================
print("\n[7/7] Computing metrics and plotting comparison...")

def compute_daily_metrics(predictions, test_df, k=100):
    pred_df = test_df[['TX_TIME_DAYS','CUSTOMER_ID','TX_FRAUD']].copy()
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
    auc_roc = roc_auc_score(y_test, preds)
    prec_vals, rec_vals, _ = precision_recall_curve(y_test, preds)
    auc_pr   = auc(rec_vals, prec_vals)
    p100, cp100 = compute_daily_metrics(preds, test_df, k=100)
    results[name] = {
        'AUC-ROC'                      : auc_roc,
        'AUC-PR'                       : auc_pr,
        'Avg Daily Precision@100'      : p100,
        'Avg Daily Card Precision@100' : cp100,
        'Training Time (s)'            : train_time,
        '_prec_vals'                   : prec_vals,
        '_rec_vals'                    : rec_vals,
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

delta_roc  = (graph_m['AUC-ROC'] - base_m['AUC-ROC']) * 100
delta_pr   = (graph_m['AUC-PR']  - base_m['AUC-PR'])  * 100
delta_p100 = (graph_m['Avg Daily Precision@100'] - base_m['Avg Daily Precision@100']) * 100
delta_cp100= (graph_m['Avg Daily Card Precision@100'] - base_m['Avg Daily Card Precision@100']) * 100

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
print(f"\n  Verdict: {verdict}\n")

# ── Plot 1: PR Curves ────────────────────────────────────────────────────────
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

# ── Plot 2: Bar comparison ───────────────────────────────────────────────────
ax2 = axes[1]
metrics_labels = ['AUC-ROC', 'AUC-PR', 'Precision@100', 'Card Prec@100']
vals_base  = [base_m['AUC-ROC'],  base_m['AUC-PR'],
              base_m['Avg Daily Precision@100'],
              base_m['Avg Daily Card Precision@100']]
vals_graph = [graph_m['AUC-ROC'], graph_m['AUC-PR'],
              graph_m['Avg Daily Precision@100'],
              graph_m['Avg Daily Card Precision@100']]

x = np.arange(len(metrics_labels))
width = 0.35
bars1 = ax2.bar(x - width/2, vals_base,  width, label='Baseline LightGBM', color='#2196F3', alpha=0.85)
bars2 = ax2.bar(x + width/2, vals_graph, width, label='+ Node2Vec',         color='#FF5722', alpha=0.85)

for bar in bars1 + bars2:
    h = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., h + 0.003,
             f'{h:.3f}', ha='center', va='bottom', fontsize=8)

ax2.set_xticks(x)
ax2.set_xticklabels(metrics_labels)
ax2.set_ylim([0.5, 1.05])
ax2.set_title('Model Comparison: Key Metrics')
ax2.legend()

plt.tight_layout()
output_path = os.path.join(os.path.dirname(__file__), 'graph_boost_comparison.png')
plt.savefig(output_path, dpi=150, bbox_inches='tight')
print(f"[DONE] Comparison chart saved → {output_path}")
plt.show()
