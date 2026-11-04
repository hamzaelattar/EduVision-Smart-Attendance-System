import { api } from "./api";
export const studentsApi = {
  list: () => api.get("/api/students"),
  create: (data) => api.post("/api/students", data),
  update: (id, data) =>
    api.put(`/api/students/${encodeURIComponent(id)}`, data),
  remove: (id) => api.delete(`/api/students/${encodeURIComponent(id)}`),
};
