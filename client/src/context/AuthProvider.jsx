// client/src/context/AuthProvider.jsx

import { useState } from "react";
import { AuthContext } from "./AuthContext";

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

  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem("attendiq_user", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("attendiq_user");
    localStorage.removeItem("attendiq_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
}