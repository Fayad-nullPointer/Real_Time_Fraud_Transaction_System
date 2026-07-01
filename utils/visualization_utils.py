import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

# General style
sns.set_style("whitegrid")

def plot_count(df, column, figsize=(8, 5), show_percentage=False):
    """
    Count plot for categorical variables.

    Parameters:
    -----------
    df : pd.DataFrame
    column : str
        Column to visualize.
    figsize : tuple
        Figure size.
    show_percentage : bool
        Whether to display percentages alongside counts.
    """

    plt.figure(figsize=figsize)

    ax = sns.countplot(
        data=df,
        x=column,
        hue=column,
        palette="viridis",
        legend=False
    )

    total = len(df)

    for container in ax.containers:
        labels = []

        for value in container.datavalues:
            if show_percentage:
                percentage = value / total * 100
                labels.append(f"{int(value)}\n({percentage:.2f}%)")
            else:
                labels.append(f"{int(value)}")

        ax.bar_label(container, labels=labels)

    plt.title(f"Count Plot of {column}")
    plt.xlabel(column)
    plt.ylabel("Count")
    plt.tight_layout()
    plt.show()


def plot_bar(df, x, y, estimator='mean', figsize=(8, 5)):
    """
    Bar plot showing aggregated values.
    """
    plt.figure(figsize=figsize)

    sns.barplot(
        data=df,
        x=x,
        y=y,
        estimator=estimator
    )

    plt.title(f"{y} by {x}")
    plt.tight_layout()
    plt.show()


def plot_box(df, x, y, figsize=(8, 5)):
    """
    Boxplot for outlier detection.
    """
    plt.figure(figsize=figsize)

    sns.boxplot(
        data=df,
        x=x,
        y=y
    )

    plt.title(f"Boxplot of {y} by {x}")
    plt.tight_layout()
    plt.show()


def plot_histogram(df, column, bins=30, kde=True, figsize=(8, 5)):
    """
    Histogram for numerical variables.
    """
    plt.figure(figsize=figsize)

    sns.histplot(
        data=df,
        x=column,
        bins=bins,
        kde=kde
    )

    plt.title(f"Distribution of {column}")
    plt.tight_layout()
    plt.show()


def plot_kde(df, column, figsize=(8, 5)):
    """
    KDE distribution plot.
    """
    plt.figure(figsize=figsize)

    sns.kdeplot(
        data=df,
        x=column,
        fill=True
    )

    plt.title(f"KDE Plot of {column}")
    plt.tight_layout()
    plt.show()


def plot_violin(df, x, y, figsize=(8, 5)):
    """
    Violin plot for distribution comparison.
    """
    plt.figure(figsize=figsize)

    sns.violinplot(
        data=df,
        x=x,
        y=y
    )

    plt.title(f"Violin Plot of {y} by {x}")
    plt.tight_layout()
    plt.show()


def plot_scatter(df, x, y, hue=None, figsize=(8, 5)):
    """
    Scatter plot for relationships.
    """
    plt.figure(figsize=figsize)

    sns.scatterplot(
        data=df,
        x=x,
        y=y,
        hue=hue
    )

    plt.title(f"{y} vs {x}")
    plt.tight_layout()
    plt.show()


def plot_correlation_heatmap(df, figsize=(12, 8)):
    """
    Correlation heatmap for numerical features.
    """
    plt.figure(figsize=figsize)

    corr = df.corr(numeric_only=True)

    sns.heatmap(
        corr,
        center=0
    )

    plt.title("Correlation Heatmap")
    plt.tight_layout()
    plt.show()


def plot_pairplot(df, columns=None, hue=None):
    """
    Pairwise relationships.
    """
    sns.pairplot(
        df[columns] if columns else df,
        hue=hue
    )
    plt.show()


def plot_missing_values(df, figsize=(10, 5)):
    """
    Missing values visualization.
    """
    missing = df.isnull().sum()
    missing = missing[missing > 0].sort_values(ascending=False)

    if len(missing) == 0:
        print("No missing values found.")
        return

    plt.figure(figsize=figsize)

    sns.barplot(
        x=missing.index,
        y=missing.values
    )

    plt.xticks(rotation=45)
    plt.title("Missing Values")
    plt.ylabel("Count")
    plt.tight_layout()
    plt.show()


def plot_fraud_financial_impact(df, amount_col="Amount", target_col="Class"):
    grouped = df.groupby(target_col)[amount_col].agg(["sum", "mean"]).reset_index()

    grouped[target_col] = grouped[target_col].map({
        0: "Legitimate",
        1: "Fraud"
    })

    fig, axes = plt.subplots(1, 2, figsize=(12,5))

    sns.barplot(data=grouped, x=target_col, y="sum", ax=axes[0], palette=["green", "red"])
    axes[0].set_title("Total Amount")
    axes[0].set_ylabel("")

    sns.barplot(data=grouped, x=target_col, y="mean", ax=axes[1], palette=["green", "red"])
    axes[1].set_title("Average Amount")
    axes[1].set_ylabel("")

    for ax in axes:
        for container in ax.containers:
            ax.bar_label(container, fmt="%.2f")

    plt.tight_layout()
    plt.show()

def plot_fraud_over_time(df, day_col="day", fraud_count="fraud_count", title="", y_label=""):
    """
    Plots number of fraud transactions over days.
    """

    plt.figure(figsize=(12,5))

    plt.plot(
        df[day_col],
        df[fraud_count],
        linewidth=2
    )

    plt.title(f"{title} Over Time (by Day)")
    plt.xlabel("Day")
    plt.ylabel(y_label)

    plt.xticks(rotation=45)
    plt.grid(True)

    plt.show()

def plot_transactions_per_day(df, date_col="TX_DATETIME"):
    """
    Plots number of transactions per day.
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df['day'] = df[date_col].dt.date

    daily_counts = df.groupby('day').size().reset_index(name='num_transactions')

    plt.figure(figsize=(12,5))
    sns.lineplot(data=daily_counts, x='day', y='num_transactions')

    plt.title("Number of Transactions Per Day")
    plt.xlabel("Day")
    plt.ylabel("Transaction Count")
    plt.xticks(rotation=45)
    plt.grid(True)

    plt.show()

    return daily_counts


def plot_time_fraud_patterns(df, target_col=""):
    fraud_only = df[df[target_col] == 1]

    fig, axes = plt.subplots(1, 2, figsize=(18,5))

    # Day name
    order = [
        "Monday","Tuesday","Wednesday",
        "Thursday","Friday","Saturday","Sunday"
    ]

    sns.countplot(data=fraud_only, x="day_name", order=order, ax=axes[0])
    axes[0].set_title("By Day Name")
    axes[0].tick_params(axis='x', rotation=45)

    # # Day of week
    # sns.countplot(data=fraud_only, x="day_of_week", ax=axes[1])
    # axes[1].set_title("By Day of Week")

    # Weekend
    sns.countplot(data=fraud_only, x="is_weekend", ax=axes[1])
    axes[1].set_xticklabels(["Weekday", "Weekend"])
    axes[1].set_title("Weekend vs Weekday")

    for ax in axes:
        for container in ax.containers:
            ax.bar_label(container)

    plt.tight_layout()
    plt.show()

def plot_fraud_amount_time_patterns(df, target_col="", amount_col=""):
    fraud_only = df[df[target_col] == 1]

    fig, axes = plt.subplots(1, 2, figsize=(14,5))

    # Day name
    order = [
        "Monday","Tuesday","Wednesday",
        "Thursday","Friday","Saturday","Sunday"
    ]

    sns.barplot(
        data=fraud_only.groupby("day_name")[amount_col].sum().reindex(order).reset_index(),
        x="day_name",
        y=amount_col,
        ax=axes[0]
    )
    axes[0].set_title("Fraud Amount by Day Name")
    axes[0].tick_params(axis='x', rotation=45)

    # Weekend
    sns.barplot(
        data=fraud_only.groupby("is_weekend")[amount_col].sum().reset_index(),
        x="is_weekend",
        y=amount_col,
        ax=axes[1],
        palette=["green", "red"]
    )
    axes[1].set_xticklabels(["Weekday", "Weekend"])
    axes[1].set_title("Weekend vs Weekday Fraud Amount")

    for ax in axes:
        for container in ax.containers:
            ax.bar_label(container, fmt="%.0f")

    plt.tight_layout()
    plt.show()

def plot_fraud_transactions_across_day(df, target_col="", time_col=""):
    fraud_only = df[df[target_col] == 1]

    plt.figure(figsize=(12,5))
    ax = sns.countplot(data=fraud_only, x=time_col)

    for container in ax.containers:
        ax.bar_label(container)

    plt.title("Fraud Transactions by Hour")
    plt.xlabel("Hour of Day")
    plt.ylabel("Fraud Count")
    plt.show()


def plot_probability_distribution(
    y_true,
    y_prob,
    threshold=0.5,
    bins=30,
    figsize=(10, 6),
    title="Density Distribution of Predicted Probabilities"
):
    """
    Plot the density distribution of predicted probabilities
    separated by the true class labels.

    Parameters
    ----------
    y_true : array-like
        Ground truth labels (0 or 1).
    y_prob : array-like
        Predicted probabilities for the positive class.
    threshold : float, default=0.5
        Classification threshold to display.
    bins : int, default=30
        Number of histogram bins.
    figsize : tuple, default=(10, 6)
        Figure size.
    title : str
        Plot title.
    """

    y_true = np.asarray(y_true)
    y_prob = np.asarray(y_prob)

    plt.figure(figsize=figsize)

    plt.hist(
        y_prob[y_true == 0],
        bins=bins,
        density=True,
        alpha=0.6,
        label="Actual Class 0",
    )

    plt.hist(
        y_prob[y_true == 1],
        bins=bins,
        density=True,
        alpha=0.6,
        label="Actual Class 1",
    )

    plt.axvline(
        x=threshold,
        linestyle="--",
        linewidth=2,
        label=f"Threshold = {threshold}"
    )

    plt.xlabel("Predicted Probability")
    plt.ylabel("Density")
    plt.title(title)
    plt.legend()
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.show()