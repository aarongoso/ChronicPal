import axios from "axios";
// https://stackoverflow.com/questions/51563821/axios-interceptors-retry-original-request-and-access-original-promise
// central Axios instance with secure defaults
// Sends cookies automatically (HTTP only refresh tokens)

const api = axios.create({
  baseURL: "http://localhost:3000",
  withCredentials: true,
});

// Attach CSRF + Access Token
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

// adapted from axios interceptor docs:
// https://axios-http.com/docs/interceptors
async function handleRefresh(err: any) {
  const original = err.config;

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
      // refresh failed → must logout user
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
      window.location.href = "/login";
    }
  }

  return Promise.reject({
    error: "An error occurred. Please try again.",
    status: err.response?.status,
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

export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/files/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export default api;
