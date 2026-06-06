// client/src/pages/StaffPage.jsx

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ClockIn from "../components/ClockIn";
import StaffHistory from "../components/staff/StaffHistory";

const NAV = [
  { key: "clockin",  label: "Clock In",  icon: "◉" },
  { key: "history",  label: "My History", icon: "◫" },
];

export default function StaffPage() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("clockin");

  // Office comes from user's assigned office in DB
  // We pass it through from the user object returned at login
  const office = user?.office || {
    lat: 6.796750,
    lng: -1.579770,
    radiusMetres: 150,
    name: "Head Office",
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">A</div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
          </div>
          <div className="flex items-center gap-3">
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
      <nav className="border-b border-zinc-800">
        <div className="max-w-lg mx-auto px-6 flex gap-1">
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
      <main className="flex-1 max-w-lg w-full mx-auto px-6 py-8">
        {view === "clockin" && (
          <ClockIn user={user} office={office} />
        )}
        {view === "history" && (
          <StaffHistory userId={user?.id} />
        )}
      </main>
    </div>
  );
}