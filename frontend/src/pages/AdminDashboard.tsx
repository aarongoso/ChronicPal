import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuditLogViewer from "../components/AuditLogViewer";
import api from "../services/Api";

// Only users with role "admin" can access this page
// Provides access to audit logs and admin tools
function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalDoctors: number;
    totalPatients: number;
    totalAdmins: number;
    pendingDoctorRequests: number;
  } | null>(null);
  const [statsError, setStatsError] = useState("");

  // Get selected view from URL query parameter
  const location = useLocation();
  const navigate = useNavigate();

  const query = new URLSearchParams(location.search);
  const view = query.get("view") || "home";

  const isAuditLogsRoute = location.pathname === "/admin/audit-logs";

  useEffect(() => {
    if (view === "auditLogs") {
      navigate("/admin/audit-logs", { replace: true });
    }
  }, [view, navigate]);

  // Check role when page loads
  useEffect(() => {
    const role = localStorage.getItem("role");
    setIsAdmin(role === "admin");
  }, []);

  // Load live system stats for the admin overview
  useEffect(() => {
    const loadStats = async () => {
      setStatsError("");
      try {
        const res = await api.get("/admin/stats");
        setStats({
          totalUsers: res.data.totalUsers,
          totalDoctors: res.data.totalDoctors,
          totalPatients: res.data.totalPatients,
          totalAdmins: res.data.totalAdmins,
          pendingDoctorRequests: res.data.pendingDoctorRequests,
        });
      } catch {
        setStatsError("Failed to load stats.");
      }
    };

    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

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
      {!isAuditLogsRoute && view === "home" && (
        <div>
          <p className="text-lg mb-4">
            Welcome, Admin. Choose a tool from the navigation bar.
          </p>

          {statsError && (
            <p className="text-sm text-red-600 mb-3">{statsError}</p>
          )}

          {/* system overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Total Users</h2>
              <p className="text-2xl mt-2">{stats ? stats.totalUsers : "--"}</p>
              <p className="text-xs text-slate-500">Live count</p>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Total Doctors</h2>
              <p className="text-2xl mt-2">
                {stats ? stats.totalDoctors : "--"}
              </p>
              <p className="text-xs text-slate-500">Live count</p>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Total Patients</h2>
              <p className="text-2xl mt-2">
                {stats ? stats.totalPatients : "--"}
              </p>
              <p className="text-xs text-slate-500">Live count</p>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">Total Admins</h2>
              <p className="text-2xl mt-2">
                {stats ? stats.totalAdmins : "--"}
              </p>
              <p className="text-xs text-slate-500">Live count</p>
            </div>

            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-sm font-semibold">
                Pending Doctor Account Requests
              </h2>
              <p className="text-2xl mt-2">
                {stats ? stats.pendingDoctorRequests : "--"}
              </p>
              <p className="text-xs text-slate-500">Live count</p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- AUDIT LOG VIEWER -------------- */}
      {(isAuditLogsRoute || view === "auditLogs") && (
        <div className="mt-6">
          {/* Full audit log table with filtering */}
          <AuditLogViewer />
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;