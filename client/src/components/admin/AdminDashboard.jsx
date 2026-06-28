// client/src/components/admin/AdminDashboard.jsx

import { useState, useEffect } from "react";
import { getTodayStats, getAttendanceHistory } from "../../api/auth";

export default function AdminDashboard({ officeId = "", offices = [] }) {
  const [stats, setStats]     = useState(null);
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [statsRes, historyRes] = await Promise.all([
          getTodayStats(officeId),
          getAttendanceHistory({ startDate: today, endDate: today, officeId }),
        ]);
        if (!cancelled) {
          setStats(statsRes);
          setRecent(historyRes.records || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [officeId]);

  const officeName = officeId
    ? offices.find(o => o.id === officeId)?.name || "Office"
    : null;

  if (loading) return <LoadingSkeleton />;

  const rate = stats?.total
    ? Math.round(((stats.onTime + stats.late) / stats.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black tracking-tight">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          {officeName && (
            <span className="ml-2 text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full">
              {officeName}
            </span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "On Time", value: stats?.onTime  ?? 0, color: "#4ade80" },
          { label: "Late",    value: stats?.late    ?? 0, color: "#fb923c" },
          { label: "Absent",  value: stats?.absent  ?? 0, color: "#f87171" },
          { label: "Total",   value: stats?.total   ?? 0, color: "#a5b4fc" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="text-3xl font-black" style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
            <div className="text-xs text-zinc-500 mt-1 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Attendance rate */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold text-sm">Attendance Rate</span>
          <span className="font-black text-lg text-emerald-400" style={{ fontVariantNumeric: "tabular-nums" }}>{rate}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${rate}%`, background: "linear-gradient(90deg, #6366f1, #4ade80)" }} />
        </div>
      </div>

      {/* Recent clock-ins */}
      <div>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-3">
          Today's Clock-ins{officeName ? ` · ${officeName}` : ""}
        </h2>
        {recent.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-2xl">
            No clock-ins recorded yet today{officeName ? ` for ${officeName}` : ""}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map(r => (
              <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: r.user?.color + "22", color: r.user?.color, border: `1.5px solid ${r.user?.color}44` }}>
                  {r.user?.avatarInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{r.user?.name}</div>
                  <div className="text-xs text-zinc-500">{r.user?.dept}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-zinc-300" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {r.clockIn}
                  </div>
                  <StatusPill status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 bg-zinc-800 rounded-xl w-48" />
      <div className="grid grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-800 rounded-2xl" />)}
      </div>
      <div className="h-20 bg-zinc-800 rounded-2xl" />
    </div>
  );
}