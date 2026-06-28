// client/src/components/admin/AdminLeaderboard.jsx

import { useState, useEffect } from "react";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function getLeaderboard({ startDate, endDate, officeId }) {
  const token = localStorage.getItem("attendiq_token");
  const params = new URLSearchParams({ startDate, endDate });
  if (officeId) params.set("officeId", officeId);
  const res = await fetch(`${BASE}/admin/leaderboard?${params}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch leaderboard");
  return data;
}

function getDateStrings() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const last7  = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  return { today, firstOfMonth, last7, last30 };
}

const DATES  = getDateStrings();
const MEDALS = ["🥇", "🥈", "🥉"];

export default function AdminLeaderboard({ officeId = "", offices = [] }) {
  const [startDate, setStartDate] = useState(DATES.firstOfMonth);
  const [endDate, setEndDate]     = useState(DATES.today);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getLeaderboard({ startDate, endDate, officeId });
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, officeId]);

  const quickFilters = [
    { label: "This Month",   start: DATES.firstOfMonth, end: DATES.today },
    { label: "Last 7 Days",  start: DATES.last7,        end: DATES.today },
    { label: "Last 30 Days", start: DATES.last30,       end: DATES.today },
  ];

  const officeName = officeId ? offices.find(o => o.id === officeId)?.name : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black tracking-tight">🏆 Leaderboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Most on-time arrivals by staff
          {officeName && (
            <span className="ml-2 text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full">
              {officeName}
            </span>
          )}
        </p>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickFilters.map(({ label, start, end }) => (
            <button key={label} onClick={() => { setStartDate(start); setEndDate(end); }}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                background: startDate === start && endDate === end ? "rgba(99,102,241,0.2)" : "transparent",
                color: startDate === start && endDate === end ? "#a5b4fc" : "#6b7280",
                border: `1px solid ${startDate === start && endDate === end ? "#6366f155" : "#3f3f46"}`,
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Staff",        value: data.totalStaff,        color: "#a5b4fc" },
            { label: "Working Days",       value: data.workingDays,       color: "#818cf8" },
            { label: "Perfect Attendance", value: data.perfectAttendance, color: "#4ade80" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black" style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div className="text-xs text-zinc-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard list */}
      {loading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-zinc-800 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">{error}</div>
      ) : !data?.leaderboard?.length ? (
        <div className="text-center py-16 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
          No attendance records{officeName ? ` for ${officeName}` : ""} in this period
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data.leaderboard.map((staff, index) => {
            const isTop3 = index < 3;
            const attendanceRate = data.workingDays > 0
              ? Math.round((staff.totalDays / data.workingDays) * 100)
              : 0;
            return (
              <div key={staff.userId}
                className="rounded-xl px-4 py-3 flex items-center gap-3 transition-all"
                style={{
                  background: isTop3 ? "rgba(99,102,241,0.08)" : "#18181b",
                  border: isTop3 ? "1px solid rgba(99,102,241,0.25)" : "1px solid #27272a",
                }}>
                <div className="w-8 text-center shrink-0">
                  {isTop3
                    ? <span style={{ fontSize: 20 }}>{MEDALS[index]}</span>
                    : <span className="text-sm font-black text-zinc-600">#{index + 1}</span>}
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: staff.color + "22", color: staff.color, border: `2px solid ${staff.color}55` }}>
                  {staff.avatarInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-white truncate">{staff.name}</div>
                  <div className="text-xs text-zinc-500">{staff.dept}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-xs text-zinc-500">On time</span>
                    <span className="font-black text-lg"
                      style={{ color: isTop3 ? "#a5b4fc" : "#71717a", fontVariantNumeric: "tabular-nums" }}>
                      {staff.onTimeCount}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    <span className="text-xs text-zinc-600">{staff.totalDays} days · {attendanceRate}%</span>
                    {staff.lateCount > 0 && (
                      <span className="text-xs text-orange-400">{staff.lateCount} late</span>
                    )}
                  </div>
                </div>
                <div className="w-16 hidden sm:block">
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${attendanceRate}%`,
                        background: isTop3 ? "linear-gradient(90deg, #6366f1, #a5b4fc)" : "#3f3f46",
                      }} />
                  </div>
                  <div className="text-xs text-zinc-600 mt-1 text-center">{attendanceRate}%</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}