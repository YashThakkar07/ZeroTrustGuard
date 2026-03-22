import api from "../api/axios";

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
};

export const accessApi = {
  accessSensitive: () => api.get("/api/access-sensitive"),
};

export const socApi = {
  getAlerts: () => api.get("/api/security/alerts"), // Updated from /api/soc/alerts
  updateAlert: (id: string) => api.patch(`/api/security/alerts/${id}/resolve`),
  getLogs: () => api.get("/api/activity-logs"), // Updated from /api/soc/logs
  getSocFiles: () => api.get("/api/files/all"),
  getDashboardStats: () => api.get("/api/dashboard/stats"),
};

export default api;
