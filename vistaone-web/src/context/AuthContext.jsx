// AuthContext - this is where we manage whether a user is logged in or not
// React Context lets us share this state with any component without passing props
import React, { createContext, useContext, useState } from "react";

// create the context object - this is like a container that holds our auth data
const AuthContext = createContext();

// custom hook so components can easily access the auth state
// instead of writing useContext(AuthContext) everywhere we just write useAuth()
export function useAuth() {
  return useContext(AuthContext);
}

// the provider wraps the entire app and makes auth state available everywhere
export function AuthProvider({ children }) {
  // check localStorage on load to see if user was already logged in
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));

  // login function - saves the token and user info
  // called from the Login page when the form is submitted
  const login = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    // persist to localStorage so the user stays logged in on page refresh
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  // logout function - clears everything
  // called from the sidebar sign out button
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  // isAuthenticated is true when we have a token
  const isAuthenticated = !!token;

  // value is the object that gets shared with every component that uses useAuth()
  const value = {
    token,
    user,
    isAuthenticated,
    login,
    logout,
  };

  return (
    // anything inside AuthProvider can now call useAuth() to get these values
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
