// client/src/components/GPSVerifier.jsx

import { useEffect, useState, useMemo } from "react";
import { useGeolocation } from "../hooks/useGeolocation";
import { validateProximity, formatDistance } from "../utils/gps";
import { validateGPS } from "../api/attendance";

/**
 * GPSVerifier
 * Step 1 of clock-in flow.
 * Shows live GPS status, mini proximity map, and validates with server.
 *
 * Props:
 *   userId      - current staff user id
 *   office      - { lat, lng, radiusMetres, name }
 *   onVerified  - callback(gpsToken) called when server confirms location
 *   onCancel    - callback to abort the flow
 */
export default function GPSVerifier({ userId, office, onVerified, onCancel }) {
  const gps = useGeolocation();
  const [serverState, setServerState] = useState("idle");
  const [serverError, setServerError] = useState(null);

  // Derived state — no useEffect needed
  const proximity = useMemo(() => {
    if (!gps.lat || !gps.lng) return null;
    return validateProximity(gps.lat, gps.lng, gps.accuracy, office);
  }, [gps.lat, gps.lng, gps.accuracy, office]);

  // Start GPS tracking on mount
  useEffect(() => {
    gps.startTracking();
    return () => gps.stopTracking();
  }, []);

  const handleVerify = async () => {
    setServerState("checking");
    setServerError(null);
    try {
      const position = gps.capturePosition(150);
      const result = await validateGPS({ ...position, userId });
      if (result.valid) {
        setServerState("verified");
        setTimeout(() => onVerified(result.gpsToken), 800);
      } else {
        setServerState("rejected");
        setServerError(`You are ${formatDistance(result.distance)} from the office.`);
      }
    } catch (err) {
      setServerState("rejected");
      setServerError(err.message);
    }
  };

  const accuracyColor =
    !gps.accuracy ? "#6e7681"
    : gps.accuracy <= 20 ? "#4ade80"
    : gps.accuracy <= 50 ? "#fb923c"
    : "#f87171";

  const inRange = proximity?.withinRange;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Step 1 of 2
        </p>
        <h2 className="text-lg font-bold text-white">Location Verification</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Confirm you are at {office.name} before proceeding.
        </p>
      </div>

      {/* GPS Status Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">

        {/* Signal indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background:
                  gps.status === "tracking" ? "#4ade80"
                  : gps.status === "acquiring" ? "#fb923c"
                  : "#f87171",
                boxShadow:
                  gps.status === "tracking"
                    ? "0 0 8px #4ade8077"
                    : "none",
                animation:
                  gps.status === "acquiring"
                    ? "pulse 1s infinite"
                    : "none",
              }}
            />
            <span className="text-sm font-semibold text-zinc-300">
              {gps.status === "idle" && "GPS Off"}
              {gps.status === "acquiring" && "Acquiring signal…"}
              {gps.status === "tracking" && "GPS Active"}
              {gps.status === "error" && "GPS Error"}
            </span>
          </div>
          {gps.accuracy && (
            <span
              className="text-xs font-mono px-2 py-0.5 rounded-full border"
              style={{
                color: accuracyColor,
                borderColor: accuracyColor + "44",
                background: accuracyColor + "11",
              }}
            >
              ±{gps.accuracy}m accuracy
            </span>
          )}
        </div>

        {/* SVG Mini Map */}
        <MiniMap
          userLat={gps.lat}
          userLng={gps.lng}
          office={office}
          proximity={proximity}
        />

        {/* Coords */}
        {gps.lat && (
          <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-500">
            <div className="bg-zinc-800 rounded-lg px-3 py-2">
              <span className="text-zinc-600">LAT</span>
              <div className="text-zinc-300 mt-0.5">{gps.lat.toFixed(6)}</div>
            </div>
            <div className="bg-zinc-800 rounded-lg px-3 py-2">
              <span className="text-zinc-600">LNG</span>
              <div className="text-zinc-300 mt-0.5">{gps.lng.toFixed(6)}</div>
            </div>
          </div>
        )}

        {/* Distance feedback */}
        {proximity && (
          <div
            className="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-3"
            style={{
              background: inRange ? "#052e1644" : "#2d0a1344",
              border: `1px solid ${inRange ? "#22c55e33" : "#ef444433"}`,
              color: inRange ? "#4ade80" : "#f87171",
            }}
          >
            <span className="text-base">{inRange ? "✓" : "✗"}</span>
            <div>
              <div>{formatDistance(proximity.distance)} from {office.name}</div>
              {!inRange && (
                <div className="text-xs mt-0.5 opacity-70">
                  Must be within {formatDistance(office.radiusMetres)}
                </div>
              )}
            </div>
          </div>
        )}

        {gps.error && (
          <div className="rounded-xl px-4 py-3 text-sm text-red-400 bg-red-950/30 border border-red-900/40">
            {gps.error}
          </div>
        )}
      </div>

      {/* Server error */}
      {serverError && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-400 bg-red-950/30 border border-red-900/40">
          {serverError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleVerify}
          disabled={
            gps.status !== "tracking" ||
            !inRange ||
            serverState === "checking" ||
            serverState === "verified"
          }
          className="w-full py-4 rounded-2xl font-bold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background:
              serverState === "verified"
                ? "linear-gradient(135deg, #052e16, #14532d)"
                : "linear-gradient(135deg, #4f46e5, #7c3aed)",
            color: serverState === "verified" ? "#4ade80" : "#fff",
            boxShadow:
              inRange && gps.status === "tracking"
                ? "0 4px 20px #4f46e533"
                : "none",
          }}
        >
          {serverState === "checking" && "Verifying location…"}
          {serverState === "verified" && "✓ Location confirmed"}
          {serverState === "idle" && (
            gps.status !== "tracking"
              ? "Waiting for GPS signal…"
              : !inRange
              ? "Move closer to the office"
              : "Confirm Location"
          )}
          {serverState === "rejected" && "Retry"}
        </button>

        <button
          onClick={onCancel}
          className="w-full py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Mini Map SVG ─────────────────────────────────────────────────────────────
function MiniMap({ userLat, userLng, office, proximity }) {
  const SIZE = 200;
  const CX = SIZE / 2, CY = SIZE / 2;

  // Scale: radius covers 1/3 of the map
  const scale = (SIZE / 3) / office.radiusMetres;

  let userX = null, userY = null;
  if (userLat && userLng) {
    const dx = (userLng - office.lng) * 111320 * Math.cos((office.lat * Math.PI) / 180);
    const dy = (userLat - office.lat) * 110540;
    userX = CX + dx * scale;
    userY = CY - dy * scale;
    // Clamp to map bounds
    userX = Math.max(8, Math.min(SIZE - 8, userX));
    userY = Math.max(8, Math.min(SIZE - 8, userY));
  }

  const inRange = proximity?.withinRange;

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800" style={{ background: "#0d1117" }}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: "100%", display: "block" }}>
        {/* Background grid */}
        {[40, 80, 120, 160].map((v) => (
          <g key={v}>
            <line x1={v} y1={0} x2={v} y2={SIZE} stroke="#21262d" strokeWidth={0.5} />
            <line x1={0} y1={v} x2={SIZE} y2={v} stroke="#21262d" strokeWidth={0.5} />
          </g>
        ))}

        {/* Office radius ring */}
        <circle
          cx={CX} cy={CY}
          r={office.radiusMetres * scale}
          fill={inRange === false ? "#ef444408" : "#22c55e08"}
          stroke={inRange === false ? "#ef444433" : "#22c55e33"}
          strokeWidth={1}
          strokeDasharray="5 4"
        />

        {/* Office dot */}
        <circle cx={CX} cy={CY} r={6} fill="#6366f1" />
        <circle cx={CX} cy={CY} r={10} fill="none" stroke="#6366f133" strokeWidth={1} />
        <text x={CX} y={CY + 22} textAnchor="middle" fontSize={9} fill="#6e7681">
          Office
        </text>

        {/* Line from office to user */}
        {userX && userY && (
          <line
            x1={CX} y1={CY} x2={userX} y2={userY}
            stroke={inRange ? "#22c55e44" : "#ef444444"}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        )}

        {/* User dot */}
        {userX && userY && (
          <g>
            <circle
              cx={userX} cy={userY} r={7}
              fill={inRange ? "#22c55e" : "#ef4444"}
              style={{ animation: "gpsBlip 1.5s infinite" }}
            />
            <circle
              cx={userX} cy={userY} r={12}
              fill="none"
              stroke={inRange ? "#22c55e55" : "#ef444455"}
              strokeWidth={1}
              style={{ animation: "gpsRing 2s infinite" }}
            />
            <text x={userX} y={userY - 14} textAnchor="middle" fontSize={9} fill={inRange ? "#4ade80" : "#f87171"}>
              You
            </text>
          </g>
        )}

        {/* Distance label */}
        {proximity && (
          <text x={SIZE / 2} y={SIZE - 6} textAnchor="middle" fontSize={8} fill="#6e7681">
            {formatDistance(proximity.distance)} away · {office.radiusMetres}m allowed
          </text>
        )}
      </svg>
    </div>
  );
}