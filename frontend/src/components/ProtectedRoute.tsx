import React from "react";
import { Navigate } from "react-router-dom";
// ref: https://stackoverflow.com/questions/43164554/react-router-private-routes
// protects any route by checking if access token exists
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    // redirect to login if user is not authenticated
    return <Navigate to="/login" replace />;
  }

  // user is authenticated, show the protected component
  return <>{children}</>;
};

export default ProtectedRoute;