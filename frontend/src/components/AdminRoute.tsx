import React from "react";
import { Navigate } from "react-router-dom";

// Restricts access to admin only routes based on stored role
// following typical role based routing patterns from React Router guides
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  // if not logged in at all
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // if logged in but not admin
  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  // user is admin, allow access
  return <>{children}</>;
};

export default AdminRoute;
