const axios = require("axios");
// External service client: ChronicPal backend -> Flask ML microservice
// Axios defaults + headers pattern based on Axios docs
type MlPredictRequest = {
  symptoms?: Array<{ name?: string; severity?: number }>;
  foodLogs?: Array<{ calories?: number }>;
  medicationLogs?: Array<{ name?: string }>;
};

type MlPredictResponse = {
  riskScore: number;
  model: string;
  featuresUsed?: Record<string, number>;
};

const mlBaseUrl = process.env.ML_BASE_URL;
const mlInternalToken = process.env.ML_INTERNAL_TOKEN;
const mlTimeoutMs = parseInt(process.env.ML_TIMEOUT_MS || "3000", 10);

if (!mlBaseUrl) {
  throw new Error("ML_BASE_URL is not set in environment variables.");
}
if (!mlInternalToken) {
  throw new Error("ML_INTERNAL_TOKEN is not set in environment variables.");
}

const mlHttp = axios.create({
  baseURL: mlBaseUrl,
  timeout: mlTimeoutMs,
  headers: {
    "Content-Type": "application/json",
    "X-Internal-ML-Token": mlInternalToken,
  },
});

function isValidPredictResponse(data: any): data is MlPredictResponse {
  // Basic response validation before returning to UI
  return (
    data &&
    typeof data === "object" &&
    typeof data.riskScore === "number" &&
    data.riskScore >= 0 &&
    data.riskScore <= 1 &&
    typeof data.model === "string"
  );
}

async function predict(payload: MlPredictRequest): Promise<MlPredictResponse> {
  const res = await mlHttp.post("/predict", payload);

  if (!isValidPredictResponse(res.data)) {
    throw new Error("Invalid ML response schema received from /predict");
  }

  return res.data;
}

module.exports = {
  predict,
};

export {};