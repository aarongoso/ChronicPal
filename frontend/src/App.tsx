import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import Logout from "./components/Logout";
import FileUpload from "./components/FileUpload";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

// Main App navigation between Login, Register, Logout, and File Upload
// Acts as the root of the frontend authentication system
function App() {
  const role = localStorage.getItem("role");
  const token = localStorage.getItem("accessToken");

  return (
    <BrowserRouter>
      {/* nav bar simplified and role aware */}
      <nav className="flex gap-6 p-4 bg-gray-100 shadow-sm justify-center text-sm font-medium">
        
        {/* Home always visible */}
        <Link to="/" className="text-blue-600 hover:text-blue-800">
          Home
        </Link>

        {/* guest navigation */}
        {!token && (
          <>
            <Link to="/login" className="text-blue-600 hover:text-blue-800">
              Login
            </Link>

            <Link to="/register" className="text-blue-600 hover:text-blue-800">
              Register
            </Link>
          </>
        )}

        {/* logged-in navigation */}
        {token && (
          <>
            {/* patient + doctor */}
            {(role === "patient" || role === "doctor") && (
              <Link
                to="/dashboard"
                className="text-blue-600 hover:text-blue-800"
              >
                Dashboard
              </Link>
            )}

            {/* admin */}
            {role === "admin" && (
              <Link
                to="/admin"
                className="text-blue-600 hover:text-blue-800"
              >
                Admin Dashboard
              </Link>
            )}

            <Link to="/upload" className="text-blue-600 hover:text-blue-800">
              Upload File
            </Link>

            <Logout />
          </>
        )}
      </nav>

      {/* App route definitions */}
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <FileUpload />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;