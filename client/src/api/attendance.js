// client/src/api/attendance.js

/**
 * All API calls related to attendance.
 * Centralised so components never write fetch() calls directly.
 */

const BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data;
}

/**
 * validateGPS
 * Sends GPS coords + faceToken to server for validation.
 * Server verifies face token first, then checks GPS proximity.
 * Returns a short-lived gpsToken if both pass.
 */
export async function validateGPS({ lat, lng, accuracy, userId, faceToken }) {
  return request("/attendance/validate-gps", {
    method: "POST",
    body: { lat, lng, accuracy, userId, faceToken },
  });
}

/**
 * clockIn
 * Records clock-in using the gpsToken from GPS verification.
 * gpsToken already embeds faceVerified + gpsVerified flags.
 */
export async function clockIn({ userId, gpsToken }) {
  return request("/attendance/clock-in", {
    method: "POST",
    body: { userId, gpsToken },
  });
}

/**
 * clockOut
 * Records clock-out time for the current active record.
 */
export async function clockOut({ userId }) {
  return request("/attendance/clock-out", {
    method: "POST",
    body: { userId },
  });
}

/**
 * getTodayRecord
 * Fetches the current user's attendance record for today.
 */
export async function getTodayRecord(userId) {
  return request(`/attendance/today/${userId}`);
}

/**
 * getAttendanceHistory
 * Staff endpoint — gets records for a date range.
 */
export async function getAttendanceHistory({ startDate, endDate, deptFilter }) {
  const params = new URLSearchParams({ startDate, endDate });
  if (deptFilter && deptFilter !== "all") params.set("dept", deptFilter);
  return request(`/attendance/history?${params}`);
}

/**
 * getDashboardStats
 * Admin endpoint — today's summary stats.
 */
export async function getDashboardStats() {
  return request("/attendance/stats/today");
}

/**
 * checkDeviceRegistered
 * Check if this user has a registered WebAuthn credential on this device.
 */
export async function checkDeviceRegistered(userId) {
  return request(`/auth/device-status/${userId}`);
}