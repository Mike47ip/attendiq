// client/src/components/ProtectedRoute.jsx

import { useAuth } from "../hooks/useAuth";

// ── ProtectedRoute ─────────────────────────────────────────────────────────
// Wraps any page that requires authentication and/or a specific role.
//
// Usage:
//   <ProtectedRoute>                        → just needs to be logged in
//   <ProtectedRoute roles={["admin"]}>      → must be admin or superadmin
//   <ProtectedRoute roles={["superadmin"]}> → superadmin only
//
// Superadmins always pass role checks regardless of what roles= says.

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();

  // Still checking localStorage / token
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-indigo-500 animate-spin" />
          <span className="text-zinc-600 text-sm">Checking access…</span>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <NotAuthorized reason="unauthenticated" />;
  }

  // Role check — superadmin always passes
  if (roles.length > 0 && user.role !== "superadmin" && !roles.includes(user.role)) {
    return <NotAuthorized reason="forbidden" user={user} />;
  }

  return children;
}

// ── NotAuthorized ──────────────────────────────────────────────────────────
// Shown when the user isn't logged in or doesn't have the right role.
// Keeps it minimal — just enough to understand what happened and what to do.

function NotAuthorized({ reason, user }) {
  const { logout } = useAuth();

  const isUnauthenticated = reason === "unauthenticated";

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center gap-5 text-center">

        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
          isUnauthenticated ? "bg-indigo-950" : "bg-red-950"
        }`}>
          {isUnauthenticated ? (
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
              stroke="#818cf8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none"
              stroke="#f87171" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>

        {/* Message */}
        <div>
          <h2 className="text-white font-bold text-lg mb-1">
            {isUnauthenticated ? "Sign in required" : "Access denied"}
          </h2>
          <p className="text-zinc-500 text-sm leading-relaxed">
            {isUnauthenticated
              ? "You need to be signed in to view this page."
              : `Your account (${user?.role}) doesn't have permission to view this page.`}
          </p>
        </div>

        {/* Action */}
        {isUnauthenticated ? (
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-xl font-bold text-sm text-white"
            style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
          >
            Go to Sign In
          </button>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => window.history.back()}
              className="w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
            >
              Go Back
            </button>
            <button
              onClick={logout}
              className="w-full py-3 rounded-xl text-sm font-medium text-zinc-400 border border-zinc-700 hover:border-zinc-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

      </div>
    </div>
  );
}