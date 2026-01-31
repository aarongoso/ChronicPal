from __future__ import annotations
from typing import Any, Dict, List, Tuple

# Keep consistent across training and inference
FEATURE_ORDER = [
    "symptomCount",
    "avgSeverity",
    "medicationCount",
    "totalCalories",
]


def build_feature_vector(payload: Dict[str, Any]) -> Tuple[List[float], Dict[str, float]]:
    # Only non PII, explainable signals are used
    symptoms = payload.get("symptoms", []) or []
    foods = payload.get("foodLogs", []) or []
    meds = payload.get("medicationLogs", []) or []

    symptom_count = float(len(symptoms))
    medication_count = float(len(meds))

    avg_severity = 0.0
    if symptoms:
        severities: List[float] = [
            float(s.get("severity"))
            for s in symptoms
            if isinstance(s.get("severity"), (int, float))
        ]
        if severities:
            avg_severity = sum(severities) / float(len(severities))

    total_calories = 0.0
    for f in foods:
        kcal = f.get("caloriesKcal")
        if isinstance(kcal, (int, float)):
            total_calories += float(kcal)

    features_used: Dict[str, float] = {
        "symptomCount": symptom_count,
        "avgSeverity": avg_severity,
        "medicationCount": medication_count,
        "totalCalories": total_calories,
    }

    # Fixed order vector (match FEATURE_ORDER)
    vector = [features_used[name] for name in FEATURE_ORDER]
    return vector, features_used