import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
// Removed Logout import because navbar now handles logout (unused warning)
import FileUpload from "./components/FileUpload";
import AdminDashboard from "./pages/AdminDashboard";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import Navbar from "./components/Navbar"; // role aware navbar
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";

// Main App navigation between Login, Register, Logout, and File Upload
// Acts as the root of the frontend authentication system
function App() {
  // note: role and token checks are now performed inside the Navbar component
  // keeping these here would be redundant and risk UI mismatches

  return (
    <BrowserRouter>
      {/* ----- Global navbar updates based on user role ----- */}
      <Navbar />

      {/* App route definitions */}
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* -------- PATIENT ROUTE ------------ */}
        <Route
          path="/patient"
          element={
            <ProtectedRoute>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        {/* --------------- DOCTOR ROUTE ------------*/}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />

        {/* ----------- FILE UPLOAD --------- */}
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <FileUpload />
            </ProtectedRoute>
          }
        />

        {/* -------- ADMIN ROUTE ----------*/}
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