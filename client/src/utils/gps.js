// client/src/utils/gps.js

/**
 * Haversine distance calculator + GPS validation helpers.
 * This runs on BOTH frontend (preview) and backend (real validation).
 */

/**
 * haversineDistance
 * Returns distance in metres between two GPS coordinates.
 * Accounts for Earth's curvature — works globally.
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in metres
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * validateProximity
 * Frontend preview check — NOT a substitute for server validation.
 * Just gives the user immediate feedback before hitting the API.
 */
export function validateProximity(userLat, userLng, userAccuracy, office) {
  const distance = haversineDistance(
    userLat, userLng,
    office.lat, office.lng
  );

  const distanceWithBuffer = distance + (userAccuracy || 0);

  return {
    distance: Math.round(distance),
    distanceWithBuffer: Math.round(distanceWithBuffer),
    withinRange: distanceWithBuffer <= office.radiusMetres,
    accuracy: userAccuracy,
  };
}

/**
 * formatDistance
 * Human readable distance string.
 */
export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)}m`;
  return `${(metres / 1000).toFixed(1)}km`;
}