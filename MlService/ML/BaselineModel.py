# Baseline model for AI microservice with goal of interpretable risk score using Logistic Regression
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Dict, Optional

import os
import joblib
import numpy as np

from ML.Features import build_feature_vector


@dataclass
class PredictionResult:
    riskScore: float
    model: str
    featuresUsed: Dict[str, float]


class BaselineRiskModel:
   
    #Loads saved scikit-learn LogisticRegression model (joblib)
    # if no model exists yet, returns a stable placeholder score

    def __init__(self, model_path: Optional[str] = None):
        base_dir = os.path.dirname(__file__)
        self.model_path = model_path or os.path.join(base_dir, "model.joblib")
        self._model = None

        if os.path.exists(self.model_path):
            self._model = joblib.load(self.model_path)

    def predict(self, payload: Dict[str, Any]) -> PredictionResult:
        # build_feature_vector now returns (vector_list, features_used_dict)
        x_vector, features_used = build_feature_vector(payload)

        # scikit-learn expects 2D arrays (n_samples, n_features)
        # scikit-learn predict_proba input shape rules
        x = np.array(x_vector, dtype=float).reshape(1, -1)

        # If trained model is available, use it
        if self._model is not None:
            # Logistic Regression gives probability for class 1
            proba = float(self._model.predict_proba(x)[0, 1])
            proba = float(np.clip(proba, 0.0, 1.0))

            return PredictionResult(
                riskScore=proba,
                model="logreg_baseline_v1",
                featuresUsed=features_used,
            )

        return PredictionResult(
            riskScore=0.25,
            model="dummy_prior_v1",
            featuresUsed=features_used,
        )