import axios from "axios";
// central Axios instance with secure defaults
// Sends cookies automatically ( HTTP-only refresh tokens)
// CSRF support via XSRF-TOKEN cookie

const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true, // Required for sending/receiving HTTP-only cookies
});

// Attach CSRF token automatically if the backend provides it
api.interceptors.request.use((config) => {
  const csrfToken = getCookie("XSRF-TOKEN");
  if (csrfToken) {
    config.headers["X-CSRF-TOKEN"] = csrfToken;
  }

  // Attach access token for authenticated endpoints (upload, protected routes)
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  return config;
});

// Extract cookie value by name
function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
}

// Stop detailed backend errors from leaking
api.interceptors.response.use(
  (res) => res,
  (err) => {
    return Promise.reject({
      error: "An error occurred. Please try again.",
      status: err.response?.status,
    });
  }
);

// Upload a file securely using multipart/form-data
//backend encrypts file and logs the upload
export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/files/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data", // Required for file upload
    },
  });

  return response.data;
};

export default api;