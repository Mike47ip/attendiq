// client/src/pages/AdminPage.jsx

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import AdminDashboard from "../components/admin/AdminDashboard";
import AdminUsers from "../components/admin/AdminUsers";
import AdminOffices from "../components/admin/AdminOffices";
import AdminAttendance from "../components/admin/AdminAttendance";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: "⬡" },
  { key: "users",     label: "Staff",     icon: "◈" },
  { key: "offices",   label: "Offices",   icon: "◎" },
  { key: "attendance",label: "Attendance",icon: "◫" },
];

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">A</div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
            <span className="text-xs bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-0.5 rounded-full ml-1">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400 hidden sm:block">{user?.name}</span>
            <button
              onClick={logout}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all"
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {view === "dashboard"  && <AdminDashboard />}
        {view === "users"      && <AdminUsers />}
        {view === "offices"    && <AdminOffices />}
        {view === "attendance" && <AdminAttendance />}
      </main>
    </div>
  );
}