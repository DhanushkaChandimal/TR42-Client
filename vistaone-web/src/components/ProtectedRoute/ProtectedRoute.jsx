// ProtectedRoute - wraps pages that require login
// checks both our AuthContext token and teammate's authToken in localStorage
import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  // check if either auth token exists
  const hasToken = localStorage.getItem("token") || localStorage.getItem("authToken");

  // if not logged in, redirect to the login page
  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  // if logged in, render the page
  return children;
}

export default ProtectedRoute;
