// client/src/context/AuthContext.jsx

import { createContext, useContext, useState, } from "react";

const AuthContext = createContext(null);

function getStoredAuth() {
  try {
    const storedUser  = localStorage.getItem("attendiq_user");
    const storedToken = localStorage.getItem("attendiq_token");
    if (storedUser && storedToken) {
      return { user: JSON.parse(storedUser), token: storedToken };
    }
  } catch {
    localStorage.removeItem("attendiq_user");
    localStorage.removeItem("attendiq_token");
  }
  return { user: null, token: null };
}

// Read from localStorage once at init — no useEffect needed
const initial = getStoredAuth();

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(initial.user);
  const [token, setToken] = useState(initial.token);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("attendiq_user",  JSON.stringify(userData));
    localStorage.setItem("attendiq_token", authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("attendiq_user");
    localStorage.removeItem("attendiq_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}