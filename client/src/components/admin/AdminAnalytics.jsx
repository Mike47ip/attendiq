// client/src/components/admin/AdminAnalytics.jsx

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function getAnalytics({ startDate, endDate }) {
  const token = localStorage.getItem("attendiq_token");
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`${BASE}/admin/analytics?${params}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to fetch analytics");
  return data;
}

// Compute stable date strings outside component
function getDateStrings() {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const last7  = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const last30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const monday = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.toISOString().split("T")[0];
  })();
  return { today, firstOfMonth, last7, last30, monday };
}

const DATES = getDateStrings();

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs shadow-xl">
      <div className="font-bold text-white mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-zinc-400 capitalize">{p.name}:</span>
          <span className="text-white font-bold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-xs shadow-xl">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: payload[0].payload.fill }} />
        <span className="text-white font-bold">{payload[0].name}: {payload[0].value}</span>
        <span className="text-zinc-400">({payload[0].payload.percent}%)</span>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [startDate, setStartDate] = useState(DATES.firstOfMonth);
  const [endDate, setEndDate]     = useState(DATES.today);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAnalytics({ startDate, endDate });
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickFilters = [
    { label: "This Week",    start: DATES.monday,      end: DATES.today },
    { label: "This Month",   start: DATES.firstOfMonth, end: DATES.today },
    { label: "Last 30 Days", start: DATES.last30,       end: DATES.today },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black tracking-tight">Analytics</h1>
        <p className="text-zinc-500 text-sm mt-1">Attendance insights and trends</p>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">From</label>
          <input type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">To</label>
          <input type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {quickFilters.map(({ label, start, end }) => (
            <button key={label}
              onClick={() => { setStartDate(start); setEndDate(end); }}
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

      {loading ? (
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-zinc-800 rounded-2xl" />)}
          </div>
          <div className="h-64 bg-zinc-800 rounded-2xl" />
          <div className="h-64 bg-zinc-800 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 px-4 py-3 rounded-xl">{error}</div>
      ) : data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Check-ins",  value: data.summary.totalCheckIns,       color: "#a5b4fc", icon: "📋" },
              { label: "On Time",          value: data.summary.totalOnTime,          color: "#4ade80", icon: "✅" },
              { label: "Late Arrivals",    value: data.summary.totalLate,            color: "#fb923c", icon: "⚠️" },
              { label: "Attendance Rate",  value: `${data.summary.attendanceRate}%`, color: "#818cf8", icon: "📈" },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="text-lg mb-1">{icon}</div>
                <div className="text-2xl font-black" style={{ color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                <div className="text-xs text-zinc-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm text-white mb-1">Daily Attendance</h2>
            <p className="text-zinc-500 text-xs mb-5">On-time vs late per day</p>
            {data.dailyData.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.dailyData} barSize={16} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="onTime" name="On Time" fill="#4ade80" radius={[4,4,0,0]} />
                  <Bar dataKey="late"   name="Late"    fill="#fb923c" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie + Dept row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Donut */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="font-bold text-sm text-white mb-1">Attendance Breakdown</h2>
              <p className="text-zinc-500 text-xs mb-4">On-time vs Late vs Absent</p>
              {data.pieData.every(d => d.value === 0) ? (
                <div className="text-center py-8 text-zinc-600 text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.pieData} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {data.pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <div className="flex flex-col gap-2 mt-2">
                {data.pieData.map(({ name, value, fill, percent }) => (
                  <div key={name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: fill }} />
                      <span className="text-xs text-zinc-400">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{value}</span>
                      <span className="text-xs text-zinc-600">({percent}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dept breakdown */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="font-bold text-sm text-white mb-1">By Department</h2>
              <p className="text-zinc-500 text-xs mb-4">On-time rate per department</p>
              {data.deptData.length === 0 ? (
                <div className="text-center py-8 text-zinc-600 text-sm">No data for this period</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.deptData.map(({ dept, onTimeRate, total, onTime }) => (
                    <div key={dept}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-zinc-300">{dept}</span>
                        <span className="text-xs text-zinc-500">{onTime}/{total} · {onTimeRate}%</span>
                      </div>
                      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${onTimeRate}%`,
                            background: onTimeRate >= 80
                              ? "linear-gradient(90deg, #4ade80, #22c55e)"
                              : onTimeRate >= 50
                              ? "linear-gradient(90deg, #fb923c, #f59e0b)"
                              : "linear-gradient(90deg, #f87171, #ef4444)",
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Punctuality score */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <div>
                <h2 className="font-bold text-sm text-white">Overall Punctuality Score</h2>
                <p className="text-zinc-500 text-xs mt-0.5">{startDate} → {endDate}</p>
              </div>
              <div className="text-3xl font-black" style={{
                color: data.summary.attendanceRate >= 80 ? "#4ade80"
                  : data.summary.attendanceRate >= 50 ? "#fb923c" : "#f87171",
                fontVariantNumeric: "tabular-nums",
              }}>
                {data.summary.attendanceRate}%
              </div>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${data.summary.attendanceRate}%`,
                  background: data.summary.attendanceRate >= 80
                    ? "linear-gradient(90deg, #6366f1, #4ade80)"
                    : data.summary.attendanceRate >= 50
                    ? "linear-gradient(90deg, #f59e0b, #fb923c)"
                    : "linear-gradient(90deg, #ef4444, #f87171)",
                }} />
            </div>
            <div className="flex justify-between text-xs text-zinc-600 mt-2">
              <span>0%</span>
              <span>Poor (&lt;50%)</span>
              <span>Fair (50-80%)</span>
              <span>Good (&gt;80%)</span>
              <span>100%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}