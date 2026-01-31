from __future__ import annotations
from typing import Tuple, Dict
import os
import numpy as np
import joblib

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

# Logistic Regression baseline model
# Feature order must match inference exactly
# Learned the hard way that training/inference mismatch breaks predictions
from ML.Features import FEATURE_ORDER


def sigmoid(z: np.ndarray) -> np.ndarray:
    # sigmoid function to map scores into probability space
    return 1.0 / (1.0 + np.exp(-z))


def generate_synthetic_dataset(
    n: int = 4000, seed: int = 42
) -> Tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    # Feature distributions roughly reflecting real app usage
    # Symptoms dominate risk in chronic illness flare-ups
    symptom_count = rng.integers(0, 10, size=n).astype(float)
    avg_severity = rng.uniform(0, 10, size=n).astype(float)
    medication_count = rng.integers(0, 6, size=n).astype(float)

    # Calories are often missing or zero early on
    total_calories = rng.choice(
        [0.0, 0.0, 0.0, 250.0, 500.0, 800.0, 1200.0, 1600.0],
        size=n,
        replace=True,
    ).astype(float)

    # Transparent risk scoring rule
    # severity and symptom count have the strongest influence
    # medication and calories are weaker signals (correlation, not causation)
    linear_score = (
        0.55 * (avg_severity / 10.0)
        + 0.35 * (symptom_count / 10.0)
        + 0.08 * (medication_count / 6.0)
        + 0.02 * (total_calories / 2000.0)
    )

    noise = rng.normal(loc=0.0, scale=0.08, size=n)

    prob = sigmoid((linear_score + noise) * 4.0 - 1.5)
    y = (rng.random(size=n) < prob).astype(int)

    # X match FEATURE_ORDER
    X = np.column_stack(
        [symptom_count, avg_severity, medication_count, total_calories]
    ).astype(float)

    return X, y


def train_and_save(model_out_path: str) -> Dict[str, float]:
    X, y = generate_synthetic_dataset()

    # Stratified split to preserve class balance
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Logistic Regression
    model = LogisticRegression(
        solver="liblinear", 
        random_state=42,
        max_iter=1000,
    )

    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    auc = float(roc_auc_score(y_test, proba))

    # Persist trained model using joblib
    joblib.dump(model, model_out_path)

    return {"roc_auc": auc}


if __name__ == "__main__":
    # Store model inside ML directory so inference can load it cleanly
    base_dir = os.path.join(os.path.dirname(__file__), "ML")
    os.makedirs(base_dir, exist_ok=True)

    out_path = os.path.join(base_dir, "model.joblib")
    metrics = train_and_save(out_path)

    print("Baseline Logistic Regression trained and saved.")
    print(f"Saved model: {out_path}")
    print(f"Feature order: {FEATURE_ORDER}")
    print(f"Sanity ROC-AUC (synthetic): {metrics['roc_auc']:.3f}")