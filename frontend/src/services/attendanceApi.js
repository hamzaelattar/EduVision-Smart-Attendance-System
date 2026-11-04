import { api } from "./api";
export const classesApi = {
  list: () => api.get("/api/classes"),
  create: (data) => api.post("/api/classes", data),
};
export const sessionsApi = {
  list: () => api.get("/api/sessions"),
  create: (data) => api.post("/api/sessions", data),
  finalize: (id) =>
    api.post(`/api/sessions/${encodeURIComponent(id)}/finalize`),
};
export const attendanceApi = {
  list: (params) => api.get("/api/attendance", { params }),
  update: (id, data) =>
    api.put(`/api/attendance/${encodeURIComponent(id)}`, data),
};
export const reportsApi = {
  list: (params) => api.get("/api/reports", { params }),
};
