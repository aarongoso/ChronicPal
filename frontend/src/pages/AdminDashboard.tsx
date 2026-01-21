import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import AuditLogViewer from "../components/AuditLogViewer";

// Only users with role "admin" can access this page
// Provides access to audit logs and admin tools
function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  // Get selected view from URL query parameter
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const view = query.get("view") || "home";

  // Check role when page loads
  useEffect(() => {
    const role = localStorage.getItem("role");

    if (role === "admin") {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
  }, []);

  // If the user is not admin, block access
  if (!isAdmin) {
    return (
      <div className="text-center p-6">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="mt-2">You do not have permission to view this page.</p>
      </div>
    );
  }

  // If admin, show dashboard
  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* ---------------------- HOME (SYSTEM OVERVIEW) ------------------------- */}
      {view === "home" && (
        <div>
          <p className="text-lg mb-4">
            Welcome, Admin. Choose a tool from the navigation bar.
          </p>

          {/* simple placeholder system overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Total Users</h2>
              <p className="text-2xl mt-2">42</p>
              <p className="text-xs text-slate-500">Demo placeholder</p>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Total Doctors</h2>
              <p className="text-2xl mt-2">8</p>
              <p className="text-xs text-slate-500">Placeholder demo count</p>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Pending Requests</h2>
              <p className="text-2xl mt-2">3</p>
              <p className="text-xs text-slate-500">Demo only</p>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- DOCTOR REQUESTS --------------------------- */}
      {view === "doctorRequests" && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-3">
            Pending Doctor Requests
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Approve or reject doctor account creation requests
            (placeholder — backend logic to be added later).
          </p>

          {/* existing doctor request approvals */}
          <div className="space-y-3 mb-8">
            {[
              { id: 1, name: "Dr. Jane Murphy", email: "jane@clinic.ie" },
              { id: 2, name: "Dr. Paul Reilly", email: "paul@clinic.ie" },
              { id: 3, name: "Dr. Anna Doyle", email: "anna@clinic.ie" },
            ].map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 border rounded"
              >
                <div>
                  <p className="font-medium">{req.name}</p>
                  <p className="text-xs text-slate-600">{req.email}</p>
                </div>

                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-slate-900 text-white text-xs rounded hover:bg-slate-800">
                    View Request
                  </button>
                  <button className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700">
                    Approve
                  </button>
                  <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* create doctor account placeholder */}
          {/* RBAC: doctor accounts are created only after admin approval */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-2">
              Create Doctor Account
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Manual doctor account creation (admin-only).
              Intended for verified clinicians after approval.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
              <input
                type="text"
                placeholder="Doctor Full Name"
                className="border rounded p-2 text-sm"
              />
              <input
                type="email"
                placeholder="Doctor Email"
                className="border rounded p-2 text-sm"
              />
              <button
                className="md:col-span-2 bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
                // TODO: connect to backend doctor creation endpoint after midpoint
              >
                Create Doctor Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------- USERS & ROLES -------------- */}
      {view === "userManagement" && (
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-3">Users & Roles</h2>
          <p className="text-sm text-slate-500 mb-4">
            Placeholder table - real user data will come from backend.
          </p>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Role</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>

            <tbody>
              {[
                { email: "admin@chronicpal.com", role: "admin" },
                { email: "dr.smith@clinic.ie", role: "doctor" },
                { email: "patient.demo@demo.com", role: "patient" },
              ].map((user, idx) => (
                <tr key={idx} className="border-b">
                  <td className="p-2">{user.email}</td>
                  <td className="p-2">{user.role}</td>
                  <td className="p-2 text-center">
                    <button className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- AUDIT LOG VIEWER -------------- */}
      {view === "auditLogs" && (
        <div className="mt-6">
          {/* Full audit log table with filtering */}
          <AuditLogViewer />
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;