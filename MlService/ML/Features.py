from __future__ import annotations
from typing import Any, Dict, List, Tuple

# These are the feature columns the model was trained with
# The same order is used here so predictions line up correctly
FEATURE_ORDER = [
    "symptomCount",
    "avgSeverity",
    "medicationCount",
    "severeSymptomCount",
    "totalRiskTagCount",
    "spicyFoodCount",
    "dairyFoodCount",
    "glutenFoodCount",
    "highFatFoodCount",
    "caffeineFoodCount",
    "alcoholFoodCount",
    "highSugarFoodCount",
    "highSodiumFoodCount",
]


# Maps patient selected food risk tags into numeric count features
# example, two foods tagged spicy become spicyFoodCount = 2
RISK_TAG_FEATURES = {
    "spicy": "spicyFoodCount",
    "containsDairy": "dairyFoodCount",
    "containsGluten": "glutenFoodCount",
    "highFat": "highFatFoodCount",
    "caffeine": "caffeineFoodCount",
    "alcohol": "alcoholFoodCount",
    "highSugar": "highSugarFoodCount",
    "highSodium": "highSodiumFoodCount",
}


# Turn the backend data into numbers the model can use
# Also return those numbers so the UI can show what affected the prediction
def build_feature_vector(payload: Dict[str, Any]) -> Tuple[List[float], Dict[str, float]]:
    # Uses only summary values, not personal notes or raw text
    symptoms = payload.get("symptoms", []) or []
    foods = payload.get("foodLogs", []) or []
    meds = payload.get("medicationLogs", []) or []

    symptom_count = float(len(symptoms))
    medication_count = float(len(meds))

    avg_severity = 0.0
    severe_symptom_count = 0.0
    if symptoms:
        severities: List[float] = [
            float(s.get("severity"))
            for s in symptoms
            if isinstance(s.get("severity"), (int, float))
        ]
        if severities:
            avg_severity = sum(severities) / float(len(severities))
            severe_symptom_count = float(sum(1 for severity in severities if severity > 7))

    features_used: Dict[str, float] = {
        "symptomCount": symptom_count,
        "avgSeverity": avg_severity,
        "medicationCount": medication_count,
        "severeSymptomCount": severe_symptom_count,
        "totalRiskTagCount": 0.0,
        "spicyFoodCount": 0.0,
        "dairyFoodCount": 0.0,
        "glutenFoodCount": 0.0,
        "highFatFoodCount": 0.0,
        "caffeineFoodCount": 0.0,
        "alcoholFoodCount": 0.0,
        "highSugarFoodCount": 0.0,
        "highSodiumFoodCount": 0.0,
    }

    for food in foods:
        risk_tags = food.get("riskTags")
        if not isinstance(risk_tags, dict):
            continue

        for tag_name, feature_name in RISK_TAG_FEATURES.items():
            if risk_tags.get(tag_name) is True:
                features_used[feature_name] += 1.0
                features_used["totalRiskTagCount"] += 1.0

    # Match the column order used during training
    vector = [features_used[name] for name in FEATURE_ORDER]
    return vector, features_used