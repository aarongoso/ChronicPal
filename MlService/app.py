import os
import hmac
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# BaselineRiskModel handles feature extraction + prediction internally
# keeps the Flask layer thin and focused on transport/security only
from ML.BaselineModel import BaselineRiskModel

# Load environment variables
load_dotenv()

# Flask app instance (internal microservice, not public facing)
app = Flask(__name__)

INTERNAL_ML_TOKEN = os.getenv("INTERNAL_ML_TOKEN", "")
MODEL = BaselineRiskModel()

def _is_internal_request_authorised(req) -> bool:
    # no public users
    provided = req.headers.get("X-Internal-ML-Token", "")

    # compare_digest avoids timing attacks
    return bool(INTERNAL_ML_TOKEN) and hmac.compare_digest(
        provided, INTERNAL_ML_TOKEN
    )


@app.before_request
def enforce_internal_auth():
    # Lock down /predict so only the backend can call it
    if request.path == "/predict":
        if not _is_internal_request_authorised(request):
            return jsonify(
                {
                    "error": "unauthorised",
                    "message": "Missing or invalid internal token",
                }
            ), 401


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.post("/predict")
def predict():
    # Accept anonymised payload only
    # Backend is responsible for building this payload from DB logs
    payload = request.get_json(silent=True) or {}

    # Guardrail against accidental PII leakage
    forbidden_keys = {"userId", "email", "address"}
    if any(k in payload for k in forbidden_keys):
        return jsonify(
            {
                "error": "bad_request",
                "message": "PII-like fields detected; anonymised data only",
            }
        ), 400

    # Flask passes data through and returns the result
    result = MODEL.predict(payload)

    return jsonify(
        {
            "riskScore": result.riskScore,
            "model": result.model,
            "featuresUsed": result.featuresUsed,
        }
    ), 200


if __name__ == "__main__":
    # Bind to localhost only so service is not publicly reachable
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "5001"))

    app.run(host=host, port=port)
