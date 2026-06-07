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
 * Sends GPS coords to the server for Haversine validation.
 * Server returns a short-lived gpsToken if location is valid.
 */
export async function validateGPS({ lat, lng, accuracy, userId }) {
  return request("/attendance/validate-gps", {
    method: "POST",
    body: { lat, lng, accuracy, userId },
  });
  // Returns: { valid: true, gpsToken: "jwt...", distance: 47, officeId: "..." }
}

/**
 * clockIn
 * Records a clock-in after both GPS and biometric have passed.
 * Requires the sessionToken returned from biometric verification.
 */
export async function clockIn({ userId, sessionToken }) {
  return request("/attendance/clock-in", {
    method: "POST",
    body: { userId, sessionToken },
  });
  // Returns: { id, userId, clockIn, date, status, gpsVerified, biometricVerified }
}

/**
 * clockOut
 * Optional — records clock-out time for the current active record.
 */
export async function clockOut({ userId, sessionToken }) {
  return request("/attendance/clock-out", {
    method: "POST",
    body: { userId, sessionToken },
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
 * Manager endpoint — gets all staff records for a date range.
 */
export async function getAttendanceHistory({ startDate, endDate, deptFilter }) {
  const params = new URLSearchParams({ startDate, endDate });
  if (deptFilter && deptFilter !== "all") params.set("dept", deptFilter);
  return request(`/attendance/history?${params}`);
}

/**
 * getDashboardStats
 * Manager endpoint — today's summary stats.
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
  // Returns: { registered: true/false }
}