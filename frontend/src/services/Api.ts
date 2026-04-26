import axios from "axios";
// https://stackoverflow.com/questions/51563821/axios-interceptors-retry-original-request-and-access-original-promise
// central Axios instance with secure defaults
// Sends cookies automatically (HTTP only refresh tokens)

const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});

// Avoid duplicate in-flight calls (helps dev-mode double-invokes and rate limits)
// same key = same promise, so repeated UI calls reuse one request instead of spamming backend
const inFlight: Partial<Record<string, Promise<any>>> = {};
const dedupe = (key: string, fn: () => Promise<any>) => {
  if (inFlight[key]) return inFlight[key]!;
  inFlight[key] = fn().finally(() => {
    delete inFlight[key];
  });
  return inFlight[key]!;
};


const FOOD_BASE = "/food";
const MED_BASE = "/medications";
const SYM_BASE = "/symptoms";

// Attach CSRF + Access Token
api.interceptors.request.use((config) => {
  const csrfToken = getCookie("XSRF-TOKEN");
  if (csrfToken) {
    // CSRF token is sent in a header so backend can validate cookie + header pair
    config.headers["X-CSRF-TOKEN"] = csrfToken;
  }

  // Attach access token for authenticated endpoints (upload, protected routes)
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  return config;
});

// adapted from axios interceptor docs:
// https://axios-http.com/docs/interceptors
async function handleRefresh(err: any) {
  const original = err.config;
  const url = original?.url || "";

  // Auth step endpoints shouldnt trigger refresh token flow
  if (
    url.includes("/auth/login") ||
    url.includes("/auth/register") ||
    url.includes("/auth/mfa/verify") ||
    url.includes("/auth/mfa/setup/initiate") ||
    url.includes("/auth/mfa/setup/verify")
  ) {
    return Promise.reject({
      error: err.response?.data?.error || "Authentication failed.",
      status: err.response?.status,
      data: err.response?.data,
    });
  }

  // If backend rate-limits (429), do NOT attempt refresh
  // retry loops spam requests
  if (err.response?.status === 429) {
    return Promise.reject({
      error: err.response?.data?.error || "Too many requests. Please slow down and try again.",
      status: 429,
    });
  }

  if (
    (err.response?.status === 401 || err.response?.status === 403) &&
    !original._retry
  ) {
    original._retry = true;

    try {
      // request new access token
      const refreshRes = await axios.post(
        "http://localhost:3000/auth/refresh",
        {},
        { withCredentials: true }
      );

      const newToken = refreshRes.data?.token;
      if (newToken) {
        localStorage.setItem("accessToken", newToken);
        original.headers["Authorization"] = `Bearer ${newToken}`;
        return api(original);
      }
    } catch {
      // refresh failed must logout user
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
      window.location.href = "/login";
    }
  }

  return Promise.reject({
    error: err.response?.data?.error || "An error occurred. Please try again.",
    status: err.response?.status,
    data: err.response?.data,
  });
}

api.interceptors.response.use(
  (res) => res,
  (err) => handleRefresh(err)
);

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(name + "="))
    ?.split("=")[1];
}

export const uploadFile = async (file: File, ownerPatientId?: number) => {
  const formData = new FormData();
  formData.append("file", file);

  if (ownerPatientId) {
    formData.append("ownerPatientId", String(ownerPatientId));
  }

  const response = await api.post("/files/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const listFiles = async () => {
  const response = await api.get("/files/list");
  return response.data;
};

export const downloadFile = async (fileId: number) => {
  const response = await api.get(`/files/download/${fileId}`, {
    responseType: "blob", // file download must come back as binary, not JSON
  });

  return response.data;
};

export const deleteFile = async (fileId: number) => {
  const response = await api.delete(`/files/delete/${fileId}`);
  return response.data;
};

export const requestDoctorAccess = async (doctorEmail: string) => {
  const response = await api.post("/doctor-access/request", { doctorEmail });
  return response.data;
};

export const getDoctorAccessAssignments = async () => {
  const response = await api.get("/doctor-access");
  return response.data;
};

export const revokeDoctorAccess = async (assignmentId: number) => {
  const response = await api.delete(`/doctor-access/${assignmentId}`);
  return response.data;
};

export const getDoctorAccessRequests = async () => {
  const response = await api.get("/doctor-access/requests");
  return response.data;
};

export const getDoctorAssignedPatients = async () => {
  const response = await api.get("/doctor-access/assigned");
  return response.data;
};

export const acceptDoctorAccessRequest = async (assignmentId: number) => {
  const response = await api.post(`/doctor-access/requests/${assignmentId}/accept`);
  return response.data;
};

export const rejectDoctorAccessRequest = async (assignmentId: number) => {
  const response = await api.post(`/doctor-access/requests/${assignmentId}/reject`);
  return response.data;
};

export const getDoctorPatientHistory = async (
  patientId: number,
  params?: { days?: number; limit?: number }
) => {
  const safeDays = Number.isFinite(params?.days) ? params!.days : 30;
  const safeLimit = Number.isFinite(params?.limit) ? params!.limit : 10;
  return dedupe(`doctor-patient-history-${patientId}-${safeDays}-${safeLimit}`, async () => {
    const response = await api.get(
      `/doctor/patients/${patientId}/history?days=${safeDays}&limit=${safeLimit}`
    );
    return response.data;
  });
};

export const getDoctorAiSummary = async (patientId: number, days?: number) => {
  const safeDays = Number.isFinite(days) ? days : 30;
  return dedupe(`doctor-ai-summary-${patientId}-${safeDays}`, async () => {
    const response = await api.get(`/doctor/ai-summaries/${patientId}?days=${safeDays}`);
    return response.data;
  });
};

export const addDoctorPatientNote = async (patientId: number, body: string) => {
  const response = await api.post(`/doctor/patients/${patientId}/notes`, { body });
  return response.data;
};

export const deleteDoctorPatientNote = async (patientId: number, noteId: number) => {
  const response = await api.delete(`/doctor/patients/${patientId}/notes/${noteId}`);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export type PatientProfilePayload = {
  dateOfBirth?: string | null;
  heightCm?: number | string | null;
  weightKg?: number | string | null;
  bloodType?: string | null;
  gender?: string | null;
  chronicConditions?: string | null;
  allergies?: string | null;
  medicalHistorySummary?: string | null;
};

export const getPatientProfile = async () => {
  const response = await api.get("/patient/profile");
  return response.data;
};

export const updatePatientProfile = async (payload: PatientProfilePayload) => {
  const response = await api.put("/patient/profile", payload);
  return response.data;
};

export const disableMfa = async (payload: { code: string; password?: string }) => {
  const response = await api.post("/auth/mfa/disable", payload);
  return response.data;
};

// ----------- AI ------------
// Personal Insights (patient only)
export const getPersonalInsights = async (days: number) => {
  const safeDays = Number.isFinite(days) ? days : 7;
  return dedupe(`personal-insights-${safeDays}`, async () => {
    const response = await api.get(`/ai/personal-insights?days=${safeDays}`);
    return response.data;
  });
};

// AI flare up prediction (patient only)
export const getAiPrediction = async (days?: number) => {
  const safeDays = Number.isFinite(days) ? days : 7;
  return dedupe(`ai-predict-${safeDays}`, async () => {
    const response = await api.post("/ai/predict", { days: safeDays });
    return response.data;
  });
};

// AI correlations summary (patient only)
export const getAiCorrelations = async (days?: number) => {
  const safeDays = Number.isFinite(days) ? days : 7;
  return dedupe(`ai-correlations-${safeDays}`, async () => {
    const response = await api.get(`/ai/correlations?days=${safeDays}`);
    return response.data;
  });
};

// ------------ SYMPTOMS ---------------------
export const logSymptom = async (payload: {
  symptomName: string;
  severity: number; // 1..10
  notes?: string;
  loggedAt?: string;
}) => {
  const response = await api.post(`${SYM_BASE}/log`, payload);
  return response.data;
};

export const getMySymptomLogs = async (params?: {
  days?: number;
  limit?: number;
  from?: string;
  to?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.days) query.set("days", String(params.days));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return dedupe(`symptom-logs-${suffix}`, async () => {
    const response = await api.get(`${SYM_BASE}/my-logs${suffix}`);
    return response.data;
  });
};

export const deleteSymptomLog = async (id: number) => {
  const response = await api.delete(`${SYM_BASE}/${id}`);
  return response.data;
};

// ------------------ FOOD ---------------------------

export const searchFood = async (q: string) => {
  const query = new URLSearchParams();
  query.set("q", q);
  const response = await api.get(`${FOOD_BASE}/search?${query.toString()}`);
  return response.data;
};

export const logFood = async (payload: {
  externalId: string;
  source: "NUTRITIONIX" | "OPENFOODFACTS";
  consumedAt: string;
  notes?: string;
  riskTags?: Record<string, boolean>;
}) => {
  const response = await api.post(`${FOOD_BASE}/log`, payload);
  return response.data;
};

export const logFoodManual = async (payload: {
  name: string;
  consumedAt: string; 
  caloriesKcal?: number;
  notes?: string;
  riskTags?: Record<string, boolean>;
}) => {
  const response = await api.post(`${FOOD_BASE}/manual-log`, payload);
  return response.data;
};

export const getMyFoodLogs = async (params?: {
  days?: number;
  limit?: number;
  from?: string;
  to?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.days) query.set("days", String(params.days));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return dedupe(`food-logs-${suffix}`, async () => {
    const response = await api.get(`${FOOD_BASE}/my-logs${suffix}`);
    return response.data;
  });
};

export const deleteFoodLog = async (id: number) => {
  const response = await api.delete(`${FOOD_BASE}/${id}`);
  return response.data;
};

// ----------------MEDICATION------------------

export const searchMedication = async (q: string) => {
  const query = new URLSearchParams();
  query.set("q", q);
  const response = await api.get(`${MED_BASE}/search?${query.toString()}`);
  return response.data;
};

export const logMedication = async (payload: {
  externalId: string;
  source: "OPENFDA" | "DAILYMED";
  takenAt: string;
}) => {
  const response = await api.post(`${MED_BASE}/log`, payload);
  return response.data;
};

export const logMedicationManual = async (payload: {
  medicationName: string;
  // rfontend now sends structured dose fields to match the backend
  // replaced "dosage" string
  doseQty?: number; 
  doseUnit?: string;
  notes?: string;
  takenAt: string;
}) => {
  const response = await api.post(`${MED_BASE}/manual-log`, payload);
  return response.data;
};

export const getMyMedicationLogs = async (params?: {
  days?: number;
  limit?: number;
  from?: string;
  to?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.days) query.set("days", String(params.days));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return dedupe(`med-logs-${suffix}`, async () => {
    const response = await api.get(`${MED_BASE}/my-logs${suffix}`);
    return response.data;
  });
};

export const deleteMedicationLog = async (id: number) => {
  const response = await api.delete(`${MED_BASE}/${id}`);
  return response.data;
};

// --------------- FREQUENT ITEMS --------------
export const getFrequentItems = async (params?: {
  days?: number;
  type?: "food" | "medication" | "symptom" | "all";
}) => {
  const query = new URLSearchParams();
  if (params?.days) query.set("days", String(params.days));
  if (params?.type) query.set("type", params.type);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return dedupe(`frequent-items-${suffix}`, async () => {
    const response = await api.get(`/frequent-items${suffix}`);
    return response.data;
  });
};

// --------------- FAVOURITES --------------
export const getFavourites = async (type?: "FOOD" | "MEDICATION") => {
  const query = type ? `?type=${type}` : "";
  return dedupe(`favourites-${type || "ALL"}`, async () => {
    const response = await api.get(`/favourites${query}`);
    return response.data;
  });
};

export const addFavourite = async (payload: {
  type: "FOOD" | "MEDICATION";
  name: string;
  externalId?: string | null;
  source?: "NUTRITIONIX" | "OPENFOODFACTS" | "OPENFDA" | "DAILYMED" | "MANUAL" | null;
}) => {
  const response = await api.post("/favourites", payload);
  return response.data;
};

export const deleteFavourite = async (id: number) => {
  const response = await api.delete(`/favourites/${id}`);
  return response.data;
};

export default api;
