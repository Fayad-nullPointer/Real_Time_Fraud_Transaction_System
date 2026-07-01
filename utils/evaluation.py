import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    average_precision_score,
    RocCurveDisplay,
    PrecisionRecallDisplay,
    precision_score,
    recall_score,
    f1_score
)

def evaluate_w_visualization(
    y_test,
    y_pred,
    y_prob=None,
    model_name="Model"
):
    """
    Evaluate classification model with optional probability-based metrics.

    If y_prob is provided:
    - ROC-AUC
    - PR-AUC
    - ROC curve
    - PR curve

    Always:
    - classification report
    - confusion matrix
    """

    print(f"\n==================== {model_name} ====================")

    # -------------------------
    # Classification report
    # -------------------------
    print(classification_report(
        y_test,
        y_pred,
        target_names=["Legit", "Fraud"],
        zero_division=0
    ))

    # -------------------------
    # Probability-based metrics
    # -------------------------
    if y_prob is not None:
        roc_auc = roc_auc_score(y_test, y_prob)
        pr_auc = average_precision_score(y_test, y_prob)

        print(f"ROC-AUC:  {roc_auc:.4f}")
        print(f"PR-AUC:   {pr_auc:.4f}")

    else:
        roc_auc = None
        pr_auc = None
        print("ROC-AUC:  Not available (y_prob=None)")
        print("PR-AUC:   Not available (y_prob=None)")

    # -------------------------
    # Confusion Matrix
    # -------------------------
    cm = confusion_matrix(y_test, y_pred)

    plt.figure(figsize=(5,4))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=["Legit", "Fraud"],
        yticklabels=["Legit", "Fraud"]
    )
    plt.title(f"{model_name} - Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.show()

    # -------------------------
    # ROC Curve
    # -------------------------
    if y_prob is not None:
        RocCurveDisplay.from_predictions(y_test, y_prob)
        plt.title(f"{model_name} - ROC Curve")
        plt.show()

        PrecisionRecallDisplay.from_predictions(y_test, y_prob)
        plt.title(f"{model_name} - Precision-Recall Curve")
        plt.show()

    # -------------------------
    # Return results
    # -------------------------
    precision, recall, f1, accuracy = extract_classification_metrics(cm)

    return {
        "Model": model_name,
        "Accuracy": accuracy,
        "Precision": precision,
        "Recall": recall,
        "F1 Score": f1,
        "ROC-AUC": roc_auc,
        "PR-AUC": pr_auc,
        "Confusion Matrix": cm,
        "y_pred": y_pred,
        "y_prob": y_prob
    }

def extract_classification_metrics(cm):
    tn, fp, fn, tp = cm.ravel()

    precision = tp / (tp + fp) if (tp + fp) else 0
    recall    = tp / (tp + fn) if (tp + fn) else 0
    f1        = (2 * precision * recall / (precision + recall)
                 if (precision + recall) else 0)
    accuracy  = (tp + tn) / (tp + tn + fp + fn)

    return precision, recall, f1, accuracy

def find_best_threshold(
    y_test,
    y_prob,
    step=0.01,
    metric="f1"
):
    """
    Find optimal classification threshold for binary fraud detection.

    Parameters
    ----------
    y_test : array-like
        True labels (0/1)
    y_prob : array-like
        Predicted probabilities for class 1 (fraud)
    step : float
        Threshold step size
    metric : str
        Metric to optimize ("f1", "precision", "recall")

    Returns
    -------
    best_threshold : float
    results_df : pd.DataFrame
    """

    thresholds = np.arange(step, 1, step)
    results = []

    for t in thresholds:
        y_pred = (y_prob >= t).astype(int)

        results.append({
            "threshold": t,
            "precision": precision_score(y_test, y_pred, zero_division=0),
            "recall": recall_score(y_test, y_pred, zero_division=0),
            "f1": f1_score(y_test, y_pred, pos_label=1, zero_division=0),
        })

    results_df = pd.DataFrame(results)

    best_idx = results_df[metric].values.argmax()
    best = results_df.iloc[best_idx]

    print(f"\nBest threshold (by {metric}): {best['threshold']:.2f}")
    print(f"Precision: {best['precision']:.3f}")
    print(f"Recall:    {best['recall']:.3f}")
    print(f"F1:        {best['f1']:.3f}")

    return best["threshold"], results_df