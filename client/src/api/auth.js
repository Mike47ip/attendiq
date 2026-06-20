// client/src/api/auth.js

const BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("attendiq_token") || null;
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

export async function loginUser({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function createStaffUser(data) {
  return request("/admin/users", { method: "POST", body: data });
}

export async function getAllUsers() {
  return request("/admin/users");
}

export async function updateUser(userId, data) {
  return request(`/admin/users/${userId}`, { method: "PUT", body: data });
}

export async function deleteUser(userId) {
  return request(`/admin/users/${userId}`, { method: "DELETE" });
}

export async function getAllOffices() {
  return request("/admin/offices");
}

export async function createOffice(data) {
  return request("/admin/offices", { method: "POST", body: data });
}

export async function updateOffice(officeId, data) {
  return request(`/admin/offices/${officeId}`, { method: "PUT", body: data });
}

export async function deleteOffice(officeId) {
  return request(`/admin/offices/${officeId}`, { method: "DELETE" });
}

export async function getAttendanceHistory({ startDate, endDate, userId }) {
  const params = new URLSearchParams({ startDate, endDate });
  if (userId) params.set("userId", userId);
  return request(`/admin/attendance?${params}`);
}

export async function getTodayStats() {
  return request("/admin/stats/today");
}