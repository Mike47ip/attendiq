// client/src/App.jsx

import { useState } from "react";
import ClockIn from "./components/ClockIn";

const OFFICE = {
  lat: 5.6037,
  lng: -0.1870,
  radiusMetres: 150,
  name: "Head Office",
};

const CURRENT_USER = {
  id: "cmq1hwos600013gy4jvmvrjzp",
  name: "Amara Osei",
  role: "Engineer",
  dept: "Tech",
  avatarInitials: "AO",
  color: "#6366f1",
};

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold">
              A
            </div>
            <span className="font-bold text-base tracking-tight">AttendIQ</span>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-lg mx-auto px-6 py-8">
        <ClockIn user={CURRENT_USER} office={OFFICE} />
      </main>
    </div>
  );
}