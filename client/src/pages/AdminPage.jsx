// client/src/pages/AdminPage.jsx

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../components/admin/AdminDashboard";
import AdminUsers from "../components/admin/AdminUsers";
import AdminOffices from "../components/admin/AdminOffices";
import AdminAttendance from "../components/admin/AdminAttendance";

const NAV = [
  { key: "dashboard",  label: "Dashboard",  icon: "⬡" },
  { key: "users",      label: "Staff",       icon: "◈" },
  { key: "offices",    label: "Offices",     icon: "◎" },
  { key: "attendance", label: "Attendance",  icon: "◫" },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              A
            </div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
            <span className="text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full ml-1">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 hidden sm:block truncate max-w-[120px]">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-zinc-800 bg-zinc-950 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-2 sm:px-6 flex">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-3 font-semibold transition-all whitespace-nowrap flex-1 sm:flex-none justify-center sm:justify-start"
              style={{
                fontSize: "clamp(11px, 2.5vw, 14px)",
                color: view === key ? "#818cf8" : "#6b7280",
                borderBottom: view === key ? "2px solid #818cf8" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              <span className="text-base sm:text-sm">{icon}</span>
              <span className="hidden xs:inline sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {view === "dashboard"  && <AdminDashboard />}
        {view === "users"      && <AdminUsers />}
        {view === "offices"    && <AdminOffices />}
        {view === "attendance" && <AdminAttendance />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800">
        <div className="flex">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all"
              style={{
                color: view === key ? "#818cf8" : "#52525b",
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.03em" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Bottom padding on mobile so content isn't hidden behind bottom nav */}
      <div className="sm:hidden h-16" />
    </div>
  );
}