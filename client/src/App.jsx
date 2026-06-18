// client/src/App.jsx

import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import StaffPage from "./pages/StaffPage";
import SuperAdminPage from "./pages/SuperAdminPage";

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-600 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (user.role === "superadmin") return <SuperAdminPage />;
  if (user.role === "admin") return <AdminPage />;
  return <StaffPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}