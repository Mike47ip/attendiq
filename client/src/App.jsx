// client/src/App.jsx

import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import StaffPage from "./pages/StaffPage";
import SuperAdminPage from "./pages/SuperAdminPage";

function AppRouter() {
  const { user, loading } = useAuth();

  // Still resolving auth state from localStorage
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-indigo-500 animate-spin" />
          <span className="text-zinc-600 text-sm animate-pulse">Loading…</span>
        </div>
      </div>
    );
  }

  // Not logged in — show login
  if (!user) return <LoginPage />;

  // Superadmin dashboard
  if (user.role === "superadmin") {
    return (
      <ProtectedRoute roles={["superadmin"]}>
        <SuperAdminPage />
      </ProtectedRoute>
    );
  }

  // Admin dashboard
  if (user.role === "admin") {
    return (
      <ProtectedRoute roles={["admin"]}>
        <AdminPage />
      </ProtectedRoute>
    );
  }

  // Everyone else (staff, manager, supervisor) → StaffPage
  return (
    <ProtectedRoute roles={["staff", "manager", "supervisor"]}>
      <StaffPage />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}