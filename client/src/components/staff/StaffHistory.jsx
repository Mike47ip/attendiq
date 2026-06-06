// client/src/components/staff/StaffHistory.jsx

import { useState, useEffect } from "react";

const BASE = "/api";

export default function StaffHistory({ userId }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const end   = new Date().toISOString().split("T")[0];
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const res   = await fetch(`${BASE}/attendance/history/${userId}?startDate=${start}&endDate=${end}`, {
          credentials: "include",
        });
        const data = await res.json();
        setRecords(data.records || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const stats = records.reduce(
    (acc, r) => {
      if (r.status === "on-time") acc.onTime++;
      else if (r.status === "late") acc.late++;
      return acc;
    },
    { onTime: 0, late: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-black tracking-tight">My Attendance</h2>
        <p className="text-zinc-500 text-sm mt-1">Last 30 days</p>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",   value: records.length, color: "#a5b4fc" },
          { label: "On Time", value: stats.onTime,   color: "#4ade80" },
          { label: "Late",    value: stats.late,     color: "#fb923c" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
            <div className="text-2xl font-black" style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div className="text-xs text-zinc-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">{error}</div>
      )}

      {/* Records */}
      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-zinc-800 rounded-xl" />)}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
          No attendance records yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-sm">{r.date}</div>
                <div className="flex items-center gap-3 mt-1">
                  {r.biometricVerified && <span className="text-xs text-indigo-400">🔐 Biometric</span>}
                  {r.gpsVerified       && <span className="text-xs text-emerald-400">📍 GPS</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-zinc-300" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {r.clockIn}{r.clockOut ? ` → ${r.clockOut}` : ""}
                </div>
                <StatusPill status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = {
    "on-time": { label: "On Time", color: "#4ade80", bg: "#052e16" },
    late:      { label: "Late",    color: "#fb923c", bg: "#431407" },
  }[status] || { label: status, color: "#6e7681", bg: "#1c1c1c" };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}