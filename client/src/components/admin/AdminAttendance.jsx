// client/src/components/admin/AdminAttendance.jsx

import { useState, useEffect } from "react";
import { getAttendanceHistory, getAllUsers } from "../../api/auth";

export default function AdminAttendance({ officeId = "", offices = [] }) {
  const today = new Date().toISOString().split("T")[0];
  const [records, setRecords]   = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate]     = useState(today);
  const [filter, setFilter]       = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [attendanceRes, usersRes] = await Promise.all([
          getAttendanceHistory({ startDate, endDate, officeId }),
          getAllUsers(),
        ]);
        if (!cancelled) {
          setRecords(attendanceRes.records || []);
          // Only staff role, scoped to selected office if filter active
          const allStaff = (usersRes.users || []).filter(u => u.role === "staff");
          const scoped = officeId
            ? allStaff.filter(u => u.officeId === officeId)
            : allStaff;
          setUsers(scoped);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, officeId]);

  // Get unique dates in range that are weekdays
  function getWeekdaysInRange(start, end) {
    const days = [];
    const cur = new Date(start);
    const last = new Date(end);
    while (cur <= last) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) {
        days.push(cur.toISOString().split("T")[0]);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  // Build absent records — staff who have no clock-in on a given weekday
  const weekdays = getWeekdaysInRange(startDate, endDate);
  const absentList = [];
  weekdays.forEach(date => {
    users.forEach(u => {
      const hasRecord = records.some(r => r.userId === u.id && r.date === date);
      if (!hasRecord) {
        absentList.push({ id: `absent-${u.id}-${date}`, user: u, date, status: "absent" });
      }
    });
  });

  // Filter records
  const filtered =
    filter === "on-time" ? records.filter(r => r.status === "on-time") :
    filter === "late"    ? records.filter(r => r.status === "late") :
    filter === "absent"  ? absentList :
    records; // "all" shows only clock-in records (not absent)

  const officeName = officeId ? offices.find(o => o.id === officeId)?.name : null;

  const counts = {
    all:      records.length,
    "on-time": records.filter(r => r.status === "on-time").length,
    late:     records.filter(r => r.status === "late").length,
    absent:   absentList.length,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black tracking-tight">Attendance Records</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {filter === "absent" ? `${absentList.length} absent` : `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`}
          {officeName && (
            <span className="ml-2 text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full">
              {officeName}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
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
          {[
            { key: "all",      label: "All" },
            { key: "on-time",  label: "On Time" },
            { key: "late",     label: "Late" },
            { key: "absent",   label: "Absent" },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap"
              style={{
                background: filter === key
                  ? key === "absent"
                    ? "rgba(248,113,113,0.15)"
                    : "rgba(99,102,241,0.2)"
                  : "transparent",
                color: filter === key
                  ? key === "absent" ? "#f87171" : "#a5b4fc"
                  : "#6b7280",
                border: `1px solid ${
                  filter === key
                    ? key === "absent" ? "#f8717155" : "#6366f155"
                    : "#3f3f46"
                }`,
              }}>
              {label}
              <span className="ml-1.5 opacity-60">{counts[key]}</span>
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
          {filter === "absent"
            ? `No absences${officeName ? ` for ${officeName}` : ""} in this period`
            : `No records found${officeName ? ` for ${officeName}` : ""} in this period`}
        </div>
      ) : filter === "absent" ? (
        // Absent list
        <div className="flex flex-col gap-2">
          {absentList.map(a => (
            <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: a.user.color + "22", color: a.user.color, border: `1.5px solid ${a.user.color}44` }}>
                {a.user.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{a.user.name}</div>
                <div className="text-xs text-zinc-500">{a.date} · {a.user.dept}</div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "#1c0a0a", color: "#f87171" }}>
                Absent
              </span>
            </div>
          ))}
        </div>
      ) : (
        // Clock-in records
        <div className="flex flex-col gap-2">
          {filtered.map(r => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: r.user?.color + "22", color: r.user?.color, border: `1.5px solid ${r.user?.color}44` }}>
                {r.user?.avatarInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{r.user?.name}</div>
                <div className="text-xs text-zinc-500">{r.date} · {r.user?.dept}</div>
              </div>
              <div className="flex items-center gap-3 text-right">
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
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}