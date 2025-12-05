import React, { useEffect, useState } from "react";
import AuditLogViewer from "../components/AuditLogViewer"; 

// Only users with role "admin" can access this page
// Provides access to audit logs and admin tools
function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [view, setView] = useState<"home" | "auditLogs">("home");

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
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Simple navigation for admin tools */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setView("home")}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Home
        </button>

        <button
          onClick={() => setView("auditLogs")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          View Audit Logs
        </button>
      </div>

      {/* Show selected admin view */}
      {view === "home" && (
        <p className="text-lg">Welcome, Admin. Choose a tool above.</p>
      )}

      {/* Full audit log table with filtering */}
      {view === "auditLogs" && (
        <div className="mt-6">
          <AuditLogViewer />
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;