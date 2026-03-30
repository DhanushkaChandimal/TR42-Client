// ProtectedRoute - wraps pages that require login
// if the user is not authenticated it redirects them back to the login page
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function ProtectedRoute({ children }) {
  // pull isAuthenticated from our auth context
  const { isAuthenticated } = useAuth();

  // if not logged in, redirect to the login page
  // replace means it wont add to browser history so they cant hit back
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // if logged in, render whatever page was passed in as children
  return children;
}

export default ProtectedRoute;
