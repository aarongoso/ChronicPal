from __future__ import annotations
from typing import Tuple, Dict
import os
import numpy as np
import joblib

from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

from ML.Features import FEATURE_ORDER


def sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


# Creates synthetic training data for the baseline model
# This avoids using real patient data and breaching any rules
#  while still giving the model realistic looking patterns to learn from
def generate_synthetic_dataset(
    n: int = 4000, seed: int = 42
) -> Tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    # Core symptom and medication features
    symptom_count = rng.integers(0, 10, size=n).astype(float)
    avg_severity = rng.uniform(0, 10, size=n).astype(float)
    medication_count = rng.integers(0, 6, size=n).astype(float)
    severe_symptom_count = rng.integers(0, 5, size=n).astype(float)

    # Synthetic food trigger tag counts.
    # These represent how many recent food logs were tagged with each risk category.
    spicy_food_count = rng.integers(0, 4, size=n).astype(float)
    dairy_food_count = rng.integers(0, 4, size=n).astype(float)
    gluten_food_count = rng.integers(0, 4, size=n).astype(float)
    high_fat_food_count = rng.integers(0, 4, size=n).astype(float)
    caffeine_food_count = rng.integers(0, 4, size=n).astype(float)
    alcohol_food_count = rng.integers(0, 3, size=n).astype(float)
    high_sugar_food_count = rng.integers(0, 4, size=n).astype(float)
    high_sodium_food_count = rng.integers(0, 4, size=n).astype(float)
    total_risk_tag_count = (
        spicy_food_count
        + dairy_food_count
        + gluten_food_count
        + high_fat_food_count
        + caffeine_food_count
        + alcohol_food_count
        + high_sugar_food_count
        + high_sodium_food_count
    )

    # Transparent synthetic scoring rule.
    # Symptoms remain the strongest signal.
    # Food trigger tags are weaker possible contributors, not clinical proof.
    # This rule creates the labels used for training; it is explainable,
    # but it is not based on clinical trial data.
    linear_score = (
        0.50 * (avg_severity / 10.0)
        + 0.30 * (symptom_count / 10.0)
        + 0.08 * (medication_count / 6.0)
        + 0.10 * (severe_symptom_count / 5.0)
        + 0.04 * (total_risk_tag_count / 27.0)
        + 0.04 * (spicy_food_count / 4.0)
        + 0.03 * (dairy_food_count / 4.0)
        + 0.03 * (gluten_food_count / 4.0)
        + 0.04 * (high_fat_food_count / 4.0)
        + 0.03 * (caffeine_food_count / 4.0)
        + 0.03 * (alcohol_food_count / 3.0)
        + 0.02 * (high_sugar_food_count / 4.0)
        + 0.02 * (high_sodium_food_count / 4.0)
    )

    noise = rng.normal(loc=0.0, scale=0.05, size=n)

    prob = sigmoid((linear_score + noise) * 4.0 - 1.5)
    y = (rng.random(size=n) < prob).astype(int)

    # X must match FEATURE_ORDER exactly
    X = np.column_stack(
        [
            symptom_count,
            avg_severity,
            medication_count,
            severe_symptom_count,
            total_risk_tag_count,
            spicy_food_count,
            dairy_food_count,
            gluten_food_count,
            high_fat_food_count,
            caffeine_food_count,
            alcohol_food_count,
            high_sugar_food_count,
            high_sodium_food_count,
        ]
    ).astype(float)

    return X, y


# Trains the baseline Logistic Regression model and saves it to disk
# The saved model is loaded by the Flask ML service for /predict
def train_and_save(model_out_path: str) -> Dict[str, float]:
    X, y = generate_synthetic_dataset()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = LogisticRegression(
        solver="liblinear",
        random_state=42,
        max_iter=1000,
    )

    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    auc = float(roc_auc_score(y_test, proba))

    joblib.dump(model, model_out_path)

    return {"roc_auc": auc}


if __name__ == "__main__":
    base_dir = os.path.join(os.path.dirname(__file__), "ML")
    os.makedirs(base_dir, exist_ok=True)

    out_path = os.path.join(base_dir, "model.joblib")
    metrics = train_and_save(out_path)

    print("Baseline Logistic Regression trained and saved.")
    print(f"Saved model: {out_path}")
    print(f"Feature order: {FEATURE_ORDER}")
    print(f"Sanity ROC-AUC (synthetic): {metrics['roc_auc']:.3f}")
