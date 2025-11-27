import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

// Import components
import Login from "./components/Login";
import Register from "./components/Register";
import Logout from "./components/Logout";
import FileUpload from "./components/FileUpload";
import Dashboard from "./pages/Dashboard";

// Main App navigation between Login, Register, Logout, and File Upload
// Acts as the root of the frontend authentication system
function App() {
  return (
    <BrowserRouter>
      {/* nav bar used to move between main pages */}
      <nav className="flex gap-6 p-4 bg-gray-200 justify-center">
        <Link to="/login" className="text-blue-600 font-semibold">
          Login
        </Link>

        <Link to="/register" className="text-blue-600 font-semibold">
          Register
        </Link>

        <Link to="/upload" className="text-blue-600 font-semibold">
          Upload File
        </Link>

        <Logout />
      </nav>

      {/* App route definitions */}
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Auth pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Secure file upload page */}
        <Route
          path="/upload"
          element={
            <div className="flex justify-center mt-8">
              <FileUpload />
            </div>
          }
        />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
