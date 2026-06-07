// client/src/components/admin/AdminAttendance.jsx

import { useState, useEffect } from "react";
import { getAttendanceHistory } from "../../api/attendance";


export default function AdminAttendance() {
  const today = new Date().toISOString().split("T")[0];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState(today);
  const [filter, setFilter]       = useState("all");

  useEffect(() => { fetchRecords(); }, [startDate, endDate]);

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await getAttendanceHistory({ startDate, endDate });
      setRecords(res.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = records.filter(r => {
    if (filter === "on-time") return r.status === "on-time";
    if (filter === "late")    return r.status === "late";
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black tracking-tight">Attendance Records</h1>
        <p className="text-zinc-500 text-sm mt-1">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">From</label>
          <input
            type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">To</label>
          <input
            type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          {["all","on-time","late"].map(f => (
            <button
              key={f} onClick={() => setFilter(f)}
              className="px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? "rgba(99,102,241,0.2)" : "transparent",
                color: filter === f ? "#a5b4fc" : "#6b7280",
                border: `1px solid ${filter === f ? "#6366f155" : "#3f3f46"}`,
              }}
            >
              {f === "on-time" ? "On Time" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Records */}
      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-zinc-800 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
          No records found for this period
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: r.user?.color + "22", color: r.user?.color, border: `1.5px solid ${r.user?.color}44` }}
              >
                {r.user?.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{r.user?.name}</div>
                <div className="text-xs text-zinc-500">{r.date} · {r.user?.dept}</div>
              </div>
              <div className="flex items-center gap-3 text-right">
                {r.biometricVerified && (
                  <span className="text-xs text-indigo-400 hidden sm:flex items-center gap-1">🔐</span>
                )}
                {r.gpsVerified && (
                  <span className="text-xs text-emerald-400 hidden sm:flex items-center gap-1">📍</span>
                )}
                <div>
                  <div className="font-mono text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {r.clockIn}{r.clockOut ? ` → ${r.clockOut}` : ""}
                  </div>
                  <StatusPill status={r.status} />
                </div>
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
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}