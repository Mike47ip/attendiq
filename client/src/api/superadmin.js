// client/src/api/superadmin.js

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

// ── Tenants ────────────────────────────────────────────────────────────
export async function getAllTenants() {
  return request("/superadmin/tenants");
}

export async function createTenant(data) {
  return request("/superadmin/tenants", { method: "POST", body: data });
}

export async function updateTenant(tenantId, data) {
  return request(`/superadmin/tenants/${tenantId}`, { method: "PUT", body: data });
}

export async function toggleTenant(tenantId) {
  return request(`/superadmin/tenants/${tenantId}/toggle`, { method: "PATCH" });
}

export async function deleteTenant(tenantId) {
  return request(`/superadmin/tenants/${tenantId}`, { method: "DELETE" });
}

export async function getPlatformStats() {
  return request("/superadmin/stats");
}

// ── Cross-tenant users ─────────────────────────────────────────────────
export async function getAllUsersAcrossTenants() {
  return request("/superadmin/users");
}

export async function updateUserAsSuperAdmin(userId, data) {
  return request(`/superadmin/users/${userId}`, { method: "PUT", body: data });
}

export async function deleteUserAsSuperAdmin(userId) {
  return request(`/superadmin/users/${userId}`, { method: "DELETE" });
}

export async function createUserAsSuperAdmin(data) {
  return request("/superadmin/users", { method: "POST", body: data });
}

export async function getOfficesForTenant(tenantId) {
  return request(`/admin/offices?tenantId=${tenantId}`);
}