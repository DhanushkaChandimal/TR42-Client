import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { API_BASE } from "../config/api";
import { setRealtimeAuth } from "../services/supabase";

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthContext() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("authToken"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("userProfile")) || null;
    } catch {
      return null;
    }
  });
  // true once we have fresh permissions from the server (or confirmed no token).
  // Initialized to true when there is no auth token so the app does not stall
  // on a logged-out user — the refresh effect below only runs when a token exists.
  const [profileReady, setProfileReady] = useState(() => {
    if (!localStorage.getItem("authToken")) return true;
    try {
      const stored = JSON.parse(localStorage.getItem("userProfile"));
      return !!(stored?.permissions);
    } catch {
      return false;
    }
  });

  const setAuth = useCallback((newToken, userProfile) => {
    setToken(newToken);
    setUser(userProfile);
    localStorage.setItem("authToken", newToken);
    localStorage.setItem("userProfile", JSON.stringify(userProfile));
    setRealtimeAuth(newToken);
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userProfile");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setRealtimeAuth(null);
  }, []);

  const hasRole = useCallback(
    (...roles) => {
      if (!user?.roles) return false;
      return roles.some((r) => user.roles.includes(r));
    },
    [user]
  );

  /**
   * Check if the user has a given action on a resource.
   * action: "read" | "write" | "delete"
   */
  const hasPermission = useCallback(
    (resource, action = "read") => {
      if (!user) return false;
      // MASTER has all permissions
      if (user.roles?.includes("MASTER")) return true;
      return user.permissions?.[resource]?.[action] === true;
    },
    [user]
  );

  // Re-fetch profile on every app load so permissions are always fresh from the server.
  // This ensures that when MASTER changes a user's role/permissions, it takes effect
  // on the next page load without requiring the user to log out and back in.
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (!storedToken) return;

    // Hand the JWT to Supabase Realtime so RLS policies see our claims.
    setRealtimeAuth(storedToken);

    fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((profile) => {
        if (profile) {
          setUser(profile);
          localStorage.setItem("userProfile", JSON.stringify(profile));
        }
      })
      .catch(() => {})
      .finally(() => setProfileReady(true));
  }, []);

  const isMaster = hasRole("MASTER");
  const isAdmin = hasRole("MASTER", "ADMIN");

  return (
    <AuthContext.Provider
      value={{ token, user, setAuth, clearAuth, hasRole, hasPermission, isMaster, isAdmin, profileReady }}
    >
      {children}
    </AuthContext.Provider>
  );
}
