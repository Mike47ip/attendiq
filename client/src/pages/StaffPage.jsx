// client/src/pages/StaffPage.jsx

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import ClockIn from "../components/ClockIn";
import StaffHistory from "../components/staff/StaffHistory";
import FaceRegistration from "../components/FaceRegistration";

const NAV = [
  { key: "clockin", label: "Clock In",   icon: "◉" },
  { key: "history", label: "My History", icon: "◫" },
];

export default function StaffPage() {
  const { user, logout, updateUser } = useAuth();
  const [view, setView] = useState("clockin");

  const office = user?.office || {
    lat: 6.796750,
    lng: -1.579770,
    radiusMetres: 150,
    name: "Head Office",
  };

  // If face not registered yet — show registration screen before anything else
  if (!user?.faceRegistered) {
    return (
      <FaceRegistration
        userId={user.id}
        userName={user.name}
        onComplete={() => updateUser({ faceRegistered: true })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col pb-16">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
              A
            </div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 hidden sm:block truncate max-w-[140px]">
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

      {/* Content */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-8">
        {view === "clockin" && <ClockIn user={user} office={office} />}
        {view === "history" && <StaffHistory userId={user?.id} />}
      </main>

      {/* Fixed bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800">
        <div className="max-w-lg mx-auto flex">
          {NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all"
              style={{
                color: view === key ? "#818cf8" : "#52525b",
                borderTop: view === key ? "2px solid #818cf8" : "2px solid transparent",
                marginTop: -1,
              }}
            >
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}