// client/src/pages/AdminPage.jsx

import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import AdminDashboard from "../components/admin/AdminDashboard";
import AdminUsers from "../components/admin/AdminUsers";
import AdminOffices from "../components/admin/AdminOffices";
import AdminAttendance from "../components/admin/AdminAttendance";
import AdminLeaderboard from "../components/admin/AdminLeaderboard";
import AdminAnalytics from "../components/admin/AdminAnalytics";
import { getAllOffices } from "../api/auth";

const NAV = [
  { key: "dashboard",   label: "Dashboard",  icon: "⬡" },
  { key: "users",       label: "Staff",       icon: "◈" },
  { key: "offices",     label: "Offices",     icon: "◎" },
  { key: "attendance",  label: "Attendance",  icon: "◫" },
  { key: "analytics",   label: "Analytics",   icon: "📊" },
  { key: "leaderboard", label: "Leaderboard", icon: "🏆" },
];

const FILTERABLE_TABS = ["dashboard", "users", "attendance", "analytics", "leaderboard"];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [view, setView]                         = useState("dashboard");
  const [offices, setOffices]                   = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");

  useEffect(() => {
    getAllOffices()
      .then(res => setOffices(res.offices || []))
      .catch(err => console.error("Failed to load offices:", err));
  }, []);

  const showOfficeFilter = FILTERABLE_TABS.includes(view) && offices.length > 1;

  return (
    <div
      className="bg-zinc-950 text-white flex flex-col overflow-x-hidden pb-16 sm:pb-0"
      style={{ minHeight: "100dvh" }}
    >

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Row 1 — logo + sign out (always visible) */}
          <div className="h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                A
              </div>
              <span className="font-bold text-base tracking-tight">AttendIQ</span>
              <span className="text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full">
                Admin
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 hidden sm:block truncate max-w-[100px]">
                {user?.name}
              </span>
              <button
                onClick={logout}
                className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Row 2 — office filter pill (only when needed, sits below logo row on its own line) */}
          {showOfficeFilter && (
            <div className="pb-2">
              <select
                value={selectedOfficeId}
                onChange={e => setSelectedOfficeId(e.target.value)}
                className="w-full sm:w-auto bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-white text-xs font-semibold outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">All Offices</option>
                {offices.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      {/* Desktop top nav */}
      <nav className="hidden sm:block border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 flex">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all whitespace-nowrap"
              style={{
                color: view === key ? "#818cf8" : "#6b7280",
                borderBottom: view === key ? "2px solid #818cf8" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24">
        {view === "dashboard"   && <AdminDashboard  officeId={selectedOfficeId} offices={offices} />}
        {view === "users"       && <AdminUsers       officeId={selectedOfficeId} offices={offices} />}
        {view === "offices"     && <AdminOffices     offices={offices} refreshOffices={() =>
          getAllOffices().then(res => setOffices(res.offices || []))
        } />}
        {view === "attendance"  && <AdminAttendance  officeId={selectedOfficeId} offices={offices} />}
        {view === "analytics"   && <AdminAnalytics   officeId={selectedOfficeId} offices={offices} />}
        {view === "leaderboard" && <AdminLeaderboard officeId={selectedOfficeId} offices={offices} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800">
        <div className="flex">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all"
              style={{
                color: view === key ? "#818cf8" : "#52525b",
                borderTop: view === key ? "2px solid #818cf8" : "2px solid transparent",
                marginTop: -1,
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.02em" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}