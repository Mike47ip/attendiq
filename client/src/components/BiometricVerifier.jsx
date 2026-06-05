// client/src/components/BiometricVerifier.jsx

import { useEffect } from "react";
import { useBiometric } from "../hooks/useBiometric";

/**
 * BiometricVerifier
 * Step 2 of clock-in flow.
 * Handles both first-time registration and ongoing authentication.
 *
 * Props:
 *   userId       - current staff user id
 *   userName     - display name (for registration)
 *   gpsToken     - short-lived token from GPS step
 *   isRegistered - boolean: has this user registered on this device before?
 *   onVerified   - callback(sessionToken) when biometric passes
 *   onCancel     - callback to go back
 */
export default function BiometricVerifier({
  userId,
  userName,
  gpsToken,
  isRegistered,
  onVerified,
  onCancel,
}) {
  const bio = useBiometric();

  const handleAction = async () => {
    try {
      if (!isRegistered) {
        await bio.register(userId, userName);
        // After registration, immediately authenticate
        const result = await bio.authenticate(userId, gpsToken);
        onVerified(result.sessionToken);
      } else {
        const result = await bio.authenticate(userId, gpsToken);
        onVerified(result.sessionToken);
      }
    } catch {
      // error state handled by hook
    }
  };

  const isLoading =
    bio.status === "registering" || bio.status === "authenticating";
  const isDone = bio.status === "success";

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-1">
          Step 2 of 2
        </p>
        <h2 className="text-lg font-bold text-white">Biometric Verification</h2>
        <p className="text-sm text-zinc-400 mt-1">
          {isRegistered
            ? "Verify your identity to complete clock-in."
            : "Register your biometric for this device first."}
        </p>
      </div>

      {/* Support warning */}
      {!bio.isSupported && (
        <div className="rounded-xl px-4 py-3 text-sm text-amber-400 bg-amber-950/30 border border-amber-900/40">
          ⚠ WebAuthn is not supported on this browser. Please use Chrome, Safari, or Edge on a modern device.
        </div>
      )}

      {!bio.isPlatformSupported && bio.isSupported && (
        <div className="rounded-xl px-4 py-3 text-sm text-amber-400 bg-amber-950/30 border border-amber-900/40">
          ⚠ No platform biometric found. You may be prompted for a PIN or security key instead.
        </div>
      )}

      {/* Central biometric prompt area */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 flex flex-col items-center gap-4">

        {/* Animated fingerprint icon */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 88, height: 88,
            borderRadius: "50%",
            border: `2px solid ${
              isDone ? "#22c55e"
              : isLoading ? "#6366f1"
              : bio.status === "error" ? "#ef4444"
              : "#30363d"
            }`,
            background:
              isDone ? "#052e16"
              : isLoading ? "#1e1b4b"
              : bio.status === "error" ? "#2d0a13"
              : "#161b22",
            transition: "all 0.3s ease",
            boxShadow: isLoading ? "0 0 24px #6366f133" : "none",
            animation: isLoading ? "scanPulse 1.5s ease infinite" : "none",
          }}
        >
          {isDone ? (
            <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <FingerprintSVG
              color={
                isLoading ? "#a5b4fc"
                : bio.status === "error" ? "#f87171"
                : "#6e7681"
              }
              animated={isLoading}
            />
          )}
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="font-semibold text-sm text-white">
            {isDone && "Identity confirmed!"}
            {bio.status === "registering" && "Registering your biometric…"}
            {bio.status === "authenticating" && "Waiting for biometric…"}
            {bio.status === "error" && "Verification failed"}
            {bio.status === "idle" && (isRegistered ? "Ready to verify" : "Ready to register")}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {isDone && "Clock-in will complete now"}
            {isLoading && "Follow the prompt on your device"}
            {bio.status === "idle" && "Your biometric never leaves this device"}
            {bio.status === "error" && (bio.error || "Please try again")}
          </p>
        </div>

        {/* What will happen explainer */}
        {bio.status === "idle" && (
          <div className="w-full grid grid-cols-3 gap-2 mt-2">
            {[
              { icon: "📱", label: "iPhone", detail: "Face ID / Touch ID" },
              { icon: "🤖", label: "Android", detail: "Fingerprint / Face" },
              { icon: "💻", label: "Windows", detail: "Windows Hello" },
            ].map((item) => (
              <div key={item.label} className="text-center bg-zinc-800 rounded-xl p-2">
                <div className="text-lg">{item.icon}</div>
                <div className="text-xs font-semibold text-zinc-300 mt-1">{item.label}</div>
                <div className="text-xs text-zinc-600 mt-0.5">{item.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error message */}
      {bio.error && bio.status === "error" && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-400 bg-red-950/30 border border-red-900/40">
          {bio.error}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {!isDone && (
          <button
            onClick={handleAction}
            disabled={isLoading || !bio.isSupported}
            className="w-full py-4 rounded-2xl font-bold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isLoading
                ? "rgba(79,70,229,0.3)"
                : "linear-gradient(135deg, #4f46e5, #7c3aed)",
              color: "#fff",
              boxShadow: !isLoading ? "0 4px 20px #4f46e533" : "none",
            }}
          >
            {isLoading
              ? "Waiting for device…"
              : bio.status === "error"
              ? "Try Again"
              : isRegistered
              ? "Verify with Biometrics"
              : "Register & Verify"}
          </button>
        )}

        {!isLoading && !isDone && (
          <button
            onClick={onCancel}
            className="w-full py-3 rounded-2xl text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Back to GPS
          </button>
        )}
      </div>
    </div>
  );
}

// ── Fingerprint SVG Icon ─────────────────────────────────────────────────────
function FingerprintSVG({ color = "#6e7681", animated = false, size = 40 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: "stroke 0.3s ease" }}
    >
      <path
        d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"
        style={animated ? { animation: "draw 1.5s infinite" } : {}}
      />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 17.5a14.5 14.5 0 0 0 4.56 5.5" />
      <path d="M20 10.5a14.5 14.5 0 0 1 .5 3.5" />
      <path d="M6.67 15a12 12 0 0 0 .33 4" />
      <path d="M8 11.17A5 5 0 0 1 12 7" />
    </svg>
  );
}