"""
train_attention_model.py
========================
Trains a PyTorch Multi-Head Attention Neural Network for Real-Time Fraud Detection.

Calculates key classification & ranking metrics:
  - Macro F1 Score
  - Fraud Precision & Recall
  - Precision@k (for k in [50, 100, 500, 1000, top 1%, top 5%])
  - Recall@k    (for k in [50, 100, 500, 1000, top 1%, top 5%])
  - ROC-AUC & PR-AUC

Designed to run on both local machines and AWS servers (GPU/CPU auto-detection).

Usage:
------
    python scripts/train_attention_model.py --epochs 10 --batch-size 1024 --lr 1e-3
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import (
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Add project root to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from feature_engineering import FEATURE_COLS, FraudFeatureEngineer
from utils.evaluation import precision_at_k, recall_at_k

# PyTorch import check
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import DataLoader, TensorDataset
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False


class TabularAttentionClassifier(nn.Module):
    """
    Multi-Head Self-Attention Neural Network for Tabular Fraud Features.

    Architecture:
      Input Features -> Feature Projection -> Multi-Head Self-Attention Block
      -> LayerNorm & Residual Connection -> Feed-Forward MLP -> Sigmoid Logits
    """

    def __init__(
        self,
        input_dim: int,
        embed_dim: int = 128,
        num_heads: int = 4,
        hidden_dim: int = 256,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.feature_projection = nn.Sequential(
            nn.Linear(input_dim, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.ReLU(),
        )

        self.attention = nn.MultiheadAttention(
            embed_dim=embed_dim,
            num_heads=num_heads,
            dropout=dropout,
            batch_first=True,
        )

        self.norm1 = nn.LayerNorm(embed_dim)
        self.norm2 = nn.LayerNorm(embed_dim)

        self.ffn = nn.Sequential(
            nn.Linear(embed_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, embed_dim),
            nn.Dropout(dropout),
        )

        self.head = nn.Sequential(
            nn.Linear(embed_dim, hidden_dim // 2),
            nn.BatchNorm1d(hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: [batch_size, input_dim]
        h = self.feature_projection(x)  # [batch_size, embed_dim]

        # Multi-head self-attention operating over sequence dimension = 1
        h_seq = h.unsqueeze(1)  # [batch_size, 1, embed_dim]
        attn_out, _ = self.attention(h_seq, h_seq, h_seq)
        h_attn = self.norm1(h_seq + attn_out).squeeze(1)

        # Feed forward
        h_ffn = self.ffn(h_attn)
        h_out = self.norm2(h_attn + h_ffn)

        # Output logits
        logits = self.head(h_out).squeeze(-1)
        return logits


def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    cat_cols = X.select_dtypes(include=["object", "category"]).columns
    num_cols = X.select_dtypes(exclude=["object", "category"]).columns
    return ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), num_cols),
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols),
        ]
    )


def compute_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.5) -> dict:
    y_pred = (y_prob >= threshold).astype(int)

    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    fraud_p = precision_score(y_true, y_pred, zero_division=0)
    fraud_r = recall_score(y_true, y_pred, zero_division=0)
    fraud_f1 = f1_score(y_true, y_pred, pos_label=1, zero_division=0)
    roc_auc = roc_auc_score(y_true, y_prob)
    pr_auc = average_precision_score(y_true, y_prob)

    k_evals = [50, 100, 500, 1000, 0.01, 0.05]
    p_at_k = {}
    r_at_k = {}

    for k in k_evals:
        k_str = f"top_{int(k*100)}%" if isinstance(k, float) else f"top_{k}"
        p_at_k[k_str] = round(precision_at_k(y_true, y_prob, k), 4)
        r_at_k[k_str] = round(recall_at_k(y_true, y_prob, k), 4)

    return {
        "macro_f1": round(float(macro_f1), 4),
        "fraud_precision": round(float(fraud_p), 4),
        "fraud_recall": round(float(fraud_r), 4),
        "fraud_f1": round(float(fraud_f1), 4),
        "roc_auc": round(float(roc_auc), 4),
        "pr_auc": round(float(pr_auc), 4),
        "precision_at_k": p_at_k,
        "recall_at_k": r_at_k,
    }


def train_attention_model(
    train_df: pd.DataFrame,
    holdout_df: pd.DataFrame,
    oot_df: pd.DataFrame,
    epochs: int = 10,
    batch_size: int = 1024,
    lr: float = 1e-3,
    out_dir: Path = Path("models"),
):
    if not HAS_TORCH:
        print("[ERROR] PyTorch is not installed in this environment.")
        print("Please install PyTorch using: uv add torch OR pip install torch")
        sys.exit(1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"⚡ Running Attention Training on Device: [{device.type.upper()}]")

    # 1. Feature Preprocessing
    X_train = train_df[FEATURE_COLS]
    y_train = train_df["TX_FRAUD"].values
    X_holdout = holdout_df[FEATURE_COLS]
    y_holdout = holdout_df["TX_FRAUD"].values
    X_oot = oot_df[FEATURE_COLS]
    y_oot = oot_df["TX_FRAUD"].values

    preprocessor = build_preprocessor(X_train)
    X_train_proc = preprocessor.fit_transform(X_train).astype(np.float32)
    X_holdout_proc = preprocessor.transform(X_holdout).astype(np.float32)
    X_oot_proc = preprocessor.transform(X_oot).astype(np.float32)

    input_dim = X_train_proc.shape[1]
    print(f"Processed input feature dimension: {input_dim}")

    # 2. PyTorch Data Loaders
    train_dataset = TensorDataset(
        torch.tensor(X_train_proc, dtype=torch.float32),
        torch.tensor(y_train, dtype=torch.float32),
    )
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    # 3. Model & Loss Setup
    pos_count = np.sum(y_train == 1)
    neg_count = np.sum(y_train == 0)
    pos_weight = torch.tensor([neg_count / max(1, pos_count)], device=device)

    model = TabularAttentionClassifier(input_dim=input_dim).to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

    # 4. Training Loop
    print("\nStarting Training Loop...")
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)

            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            optimizer.step()

            total_loss += loss.item() * len(batch_x)

        scheduler.step()
        avg_loss = total_loss / len(train_dataset)

        # Quick validation on holdout
        model.eval()
        with torch.no_grad():
            holdout_x_tensor = torch.tensor(X_holdout_proc, dtype=torch.float32).to(device)
            holdout_logits = model(holdout_x_tensor)
            holdout_probs = torch.sigmoid(holdout_logits).cpu().numpy()

        val_metrics = compute_metrics(y_holdout, holdout_probs)
        print(
            f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {avg_loss:.4f} | "
            f"Holdout Macro F1: {val_metrics['macro_f1']:.4f} | "
            f"PR-AUC: {val_metrics['pr_auc']:.4f} | "
            f"Top-100 Precision@k: {val_metrics['precision_at_k']['top_100']:.4f}"
        )

    # 5. Final Evaluation on Holdout & Out-Of-Time (OOT)
    print("\n" + "=" * 60)
    print("FINAL EVALUATION REPORT (ATTENTION MODEL)")
    print("=" * 60)

    model.eval()
    with torch.no_grad():
        holdout_probs = torch.sigmoid(model(torch.tensor(X_holdout_proc, dtype=torch.float32).to(device))).cpu().numpy()
        oot_probs = torch.sigmoid(model(torch.tensor(X_oot_proc, dtype=torch.float32).to(device))).cpu().numpy()

    holdout_res = compute_metrics(y_holdout, holdout_probs)
    oot_res = compute_metrics(y_oot, oot_probs)

    print("\n📊 HOLDOUT SPLIT METRICS:")
    print(f"  • Macro F1-Score : {holdout_res['macro_f1']:.4f}")
    print(f"  • Fraud F1-Score : {holdout_res['fraud_f1']:.4f}")
    print(f"  • Fraud Precision: {holdout_res['fraud_precision']:.4f}")
    print(f"  • Fraud Recall   : {holdout_res['fraud_recall']:.4f}")
    print(f"  • ROC-AUC        : {holdout_res['roc_auc']:.4f}")
    print(f"  • PR-AUC         : {holdout_res['pr_auc']:.4f}")
    print("  • Precision@k    :", holdout_res["precision_at_k"])
    print("  • Recall@k       :", holdout_res["recall_at_k"])

    print("\n📊 OUT-OF-TIME (OOT) SPLIT METRICS:")
    print(f"  • Macro F1-Score : {oot_res['macro_f1']:.4f}")
    print(f"  • Fraud F1-Score : {oot_res['fraud_f1']:.4f}")
    print(f"  • Fraud Precision: {oot_res['fraud_precision']:.4f}")
    print(f"  • Fraud Recall   : {oot_res['fraud_recall']:.4f}")
    print(f"  • ROC-AUC        : {oot_res['roc_auc']:.4f}")
    print(f"  • PR-AUC         : {oot_res['pr_auc']:.4f}")
    print("  • Precision@k    :", oot_res["precision_at_k"])
    print("  • Recall@k       :", oot_res["recall_at_k"])

    # 6. Save Model Artifacts
    out_dir.mkdir(parents=True, exist_ok=True)
    model_path = out_dir / "attention_fraud_model.pt"
    metrics_path = out_dir / "attention_metrics.json"

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "input_dim": input_dim,
            "preprocessor": preprocessor,
        },
        model_path,
    )

    with open(metrics_path, "w") as f:
        json.dump({"holdout": holdout_res, "oot": oot_res}, f, indent=2)

    print(f"\n✅ Attention model saved to: {model_path}")
    print(f"✅ Metrics saved to: {metrics_path}")


def find_dataset_dir(user_dir: Path) -> Path:
    candidates = [
        user_dir,
        PROJECT_ROOT / "data",
        PROJECT_ROOT / "full dataset with brief",
    ]
    for c in candidates:
        if (c / "customer_profiles.csv").exists():
            return c

    zip_path = PROJECT_ROOT / "full dataset with brief.zip"
    if zip_path.exists():
        import zipfile
        target_dir = PROJECT_ROOT / "data"
        print(f"📦 Extracting dataset from {zip_path} into {target_dir}...")
        target_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(target_dir)
        if (target_dir / "customer_profiles.csv").exists():
            return target_dir

    print("\n" + "❌ " * 20)
    print("DATASET NOT FOUND ON THIS MACHINE!")
    print("Checked locations:")
    for c in candidates:
        print(f"  - {c / 'customer_profiles.csv'}")
    print("\nTo fix on AWS, transfer the dataset from your local machine using SCP:")
    print("  scp -i /path/to/key.pem -r \"full dataset with brief/\"* ubuntu@<AWS_PUBLIC_IP>:~/Real_Time_Fraud_Transaction_System/data/")
    print("❌ " * 20 + "\n")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Train PyTorch Tabular Attention Fraud Model")
    parser.add_argument("--data-dir", type=str, default=str(PROJECT_ROOT / "data"))
    parser.add_argument("--out-dir", type=str, default=str(PROJECT_ROOT / "models"))
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=1024)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--max-rows", type=int, default=None, help="Max transactions to load (for low-RAM EC2 instances)")

    args = parser.parse_args()

    data_dir = find_dataset_dir(Path(args.data_dir))
    out_dir = Path(args.out_dir)

    print(f"Loading CSV datasets from [{data_dir}]...")
    customer_df = pd.read_csv(data_dir / "customer_profiles.csv")
    terminal_df = pd.read_csv(data_dir / "terminal_profiles.csv")
    tx_df = pd.read_csv(data_dir / "synthetic_fraud_transactions.csv")

    realtime_path = data_dir / "realtime_transactions.csv"
    if realtime_path.exists():
        print(f"Appending realtime transactions from {realtime_path}...")
        realtime_df = pd.read_csv(realtime_path)
        tx_df = pd.concat([tx_df, realtime_df], ignore_index=True)

    if args.max_rows and len(tx_df) > args.max_rows:
        print(f"⚠️ Memory Saver: Sampling latest {args.max_rows:,} transactions out of {len(tx_df):,}...")
        tx_df = tx_df.iloc[-args.max_rows:].reset_index(drop=True)

    tx_df["TX_DATETIME"] = pd.to_datetime(tx_df["TX_DATETIME"])

    print("Fitting feature engineer...")
    fe = FraudFeatureEngineer().fit(customer_df, terminal_df, tx_df)
    train_df, holdout_df, oot_df = fe.build_training_frames(tx_df)

    print(f"Dataset split counts: train={len(train_df):,}, holdout={len(holdout_df):,}, oot={len(oot_df):,}")

    train_attention_model(
        train_df=train_df,
        holdout_df=holdout_df,
        oot_df=oot_df,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
        out_dir=out_dir,
    )


if __name__ == "__main__":
    main()


