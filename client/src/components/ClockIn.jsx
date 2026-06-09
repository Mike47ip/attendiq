// client/src/components/ClockIn.jsx

import { useState, useEffect } from "react";
import FaceVerifier from "./FaceVerifier";
import GPSVerifier from "./GPSVerifier";
import { clockIn, clockOut, getTodayRecord } from "../api/attendance";

/**
 * ClockIn
 * Orchestrates the clock-in flow:
 * idle → face → gps → done → clocked-out
 *
 * New security order:
 * 1. Face verification (proves WHO you are)
 * 2. GPS verification (proves WHERE you are)
 * 3. Clock in recorded (once per day only)
 *
 * Props:
 *   user    - { id, name, role, dept, avatarInitials, color }
 *   office  - { lat, lng, radiusMetres, name }
 */
export default function ClockIn({ user, office }) {
  const [step, setStep]       = useState("idle");   // idle | face | gps | done | clocked-out
  const [faceToken, setFaceToken] = useState(null);
  const [record, setRecord]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [time, setTime]       = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Check today's record on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const todayRes = await getTodayRecord(user.id);
        setRecord(todayRes.record || null);
        if (todayRes.record?.clockIn) {
          setStep(todayRes.record?.clockOut ? "clocked-out" : "done");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const handleFaceVerified = (token) => {
    setFaceToken(token);
    setStep("gps");
  };

  const handleGPSVerified = async (gpsToken) => {
    try {
      const result = await clockIn({ userId: user.id, gpsToken });
      setRecord(result);
      setStep("done");
    } catch (err) {
      setError(err.message);
      setStep("idle");
    }
  };

  const handleClockOut = async () => {
    try {
      const result = await clockOut({ userId: user.id });
      setRecord(result);
      setStep("clocked-out");
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = () => {
    setStep("idle");
    setFaceToken(null);
    setError(null);
  };

  if (loading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-6 max-w-sm mx-auto">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.9); }
        }
        @keyframes gpsBlip {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes gpsRing {
          0% { r: 8; opacity: 0.6; }
          100% { r: 20; opacity: 0; }
        }
      `}</style>

      {/* Time display */}
      <div className="text-center" style={{ animation: "fadeUp 0.3s ease" }}>
        <div
          className="text-5xl font-black tracking-tighter leading-none"
          style={{
            fontVariantNumeric: "tabular-nums",
            background: "linear-gradient(135deg, #a5b4fc, #818cf8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
        <p className="text-zinc-500 text-sm mt-2">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
          })}
        </p>
      </div>

      {/* User card */}
      <div
        className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex items-center gap-4"
        style={{ animation: "fadeUp 0.35s ease" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{
            background: user.color + "22",
            border: `2px solid ${user.color}55`,
            color: user.color,
          }}
        >
          {user.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white text-base truncate">{user.name}</div>
          <div className="text-zinc-500 text-xs">{user.role} · {user.dept}</div>
        </div>
        {record && <StatusPill status={record.status} />}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm text-red-400 bg-red-950/30 border border-red-900/40 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-400">✕</button>
        </div>
      )}

      {/* ── IDLE ── */}
      {step === "idle" && (
        <div className="flex flex-col gap-3" style={{ animation: "fadeUp 0.4s ease" }}>
          <button
            onClick={() => setStep("face")}
            className="w-full py-4 rounded-2xl font-bold text-white text-sm transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              boxShadow: "0 4px 24px #4f46e533",
            }}
          >
            Clock In
          </button>
          <p className="text-center text-xs text-zinc-600">
            Requires face ID + GPS verification
          </p>
        </div>
      )}

      {/* ── FACE ── */}
      {step === "face" && (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <FaceVerifier
            userId={user.id}
            onVerified={handleFaceVerified}
            onCancel={reset}
          />
        </div>
      )}

      {/* ── GPS ── */}
      {step === "gps" && (
        <div style={{ animation: "fadeUp 0.3s ease" }}>
          <GPSVerifier
            userId={user.id}
            office={office}
            faceToken={faceToken}
            onVerified={handleGPSVerified}
            onCancel={() => setStep("face")}
          />
        </div>
      )}

      {/* ── DONE ── */}
      {step === "done" && record && (
        <div className="flex flex-col gap-3" style={{ animation: "fadeUp 0.3s ease" }}>
          <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-5 text-center">
            <div className="text-3xl mb-2">✓</div>
            <div className="font-bold text-emerald-400 text-lg">Clocked In</div>
            <div
              className="text-3xl font-black mt-1 tracking-tighter"
              style={{ fontVariantNumeric: "tabular-nums", color: "#4ade80" }}
            >
              {record.clockIn}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs text-zinc-600">
              {record.faceVerified && (
                <span className="flex items-center gap-1 text-indigo-400">
                  <span>👤</span> Face verified
                </span>
              )}
              {record.gpsVerified && (
                <span className="flex items-center gap-1 text-indigo-400">
                  <span>📍</span> GPS verified
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleClockOut}
            className="w-full py-3 rounded-2xl text-sm font-semibold border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
          >
            Clock Out (optional)
          </button>
        </div>
      )}

      {/* ── CLOCKED OUT ── */}
      {step === "clocked-out" && record && (
        <div
          className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center"
          style={{ animation: "fadeUp 0.3s ease" }}
        >
          <div className="font-bold text-white mb-1">Shift Complete</div>
          <div className="text-sm font-mono text-zinc-400 mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
            {record.clockIn} → {record.clockOut}
          </div>
          <div className="text-xs text-zinc-600 mt-3">See you tomorrow!</div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = {
    "on-time": { label: "On Time", color: "#4ade80", bg: "#052e16" },
    late:      { label: "Late",    color: "#fb923c", bg: "#431407" },
  }[status] || { label: status, color: "#6e7681", bg: "#161b22" };
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-5 max-w-sm mx-auto animate-pulse">
      <div className="h-14 bg-zinc-800 rounded-xl" />
      <div className="h-20 bg-zinc-800 rounded-2xl" />
      <div className="h-12 bg-zinc-800 rounded-2xl" />
    </div>
  );
}