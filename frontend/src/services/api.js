import axios from "axios";
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 12000 });
// Demo pages use local context state. These clients are ready for a future FastAPI adapter.
export const dashboardApi = { stats: () => api.get("/api/dashboard/stats") };
