import React from "react";
import { Link, useNavigate } from "react-router-dom";
import notificationIcon from "../icons/notification.png";

const Navbar: React.FC = () => {
  const navigate = useNavigate();

  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  // logout handler
  const handleLogout = () => {
    // TODO: backend logout endpoint will remove secure cookies
    localStorage.clear();
    navigate("/login");
  };

  // PUBLIC NAVBAR (not logged in) ---------------------------
  if (!token || !role) {
    return (
      <nav className="bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-2">

          <Link to="/" className="text-xl font-semibold">
            ChronicPal
          </Link>

          <div className="flex gap-3 text-sm">
            <Link
              to="/"
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Home
            </Link>
            <Link
              to="/login"
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Register
            </Link>
          </div>

        </div>
      </nav>
    );
  }

  // LOGGED IN NAVBARS (role specific) ---------------------------

  const SecureFilesButton = () => (
    <button
      onClick={() => navigate("/upload")}
      className="px-2.5 py-1 rounded hover:bg-slate-800 text-sm"
    >
      Secure Files
    </button>
  );

  const NotificationBell = () => (
    <button
      onClick={() =>
        alert("Notifications placeholder TODO")
      }
      className="px-2 py-1 rounded hover:bg-slate-800"
      title="Notifications"
    >
      <img src={notificationIcon} alt="" className="h-5 w-5" />
    </button>
  );

  // PATIENT NAVBAR ---------------------------
  if (role === "patient") {
    return (
      <nav className="bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-2">

          <div
            className="text-xl font-semibold cursor-pointer"
            onClick={() => navigate("/")}
          >
            ChronicPal Patient
          </div>

          <div className="flex gap-3 text-sm">
            <button
              onClick={() => navigate("/patient")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/patient/insights")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Insights
            </button>

            <button
              onClick={() => navigate("/patient/appointments")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Appointments
            </button>
            
            <button
              onClick={() => navigate("/patient/log?tab=symptoms")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Daily Log
            </button>

            <SecureFilesButton />
            <NotificationBell />

            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-sm"
            >
              Logout
            </button>
          </div>

        </div>
      </nav>
    );
  }

  // DOCTOR NAVBAR -------------------------------------------
  if (role === "doctor") {
    return (
      <nav className="bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-2">

          <div
            className="text-xl font-semibold cursor-pointer"
            onClick={() => navigate("/")}
          >
            ChronicPal Doctor
          </div>

          <div className="flex gap-3 text-sm">
            <button
              onClick={() => navigate("/doctor")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/doctor/patients")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Assigned Patients
            </button>

            <button
              onClick={() => navigate("/doctor/history")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Patient History
            </button>
            <button
              onClick={() =>
                alert(
                  "Notifications placeholder — Socket.io alerts will appear here after midpoint"
                )
              }
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Notifications
            </button>

            <SecureFilesButton />
            <NotificationBell />

            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>
    );
  }

  // ADMIN NAVBAR ---------------------
  if (role === "admin") {
    return (
      <nav className="bg-slate-900 text-white shadow-md">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-2">

          <div
            className="text-xl font-semibold cursor-pointer"
            onClick={() => navigate("/")}
          >
            ChronicPal Admin
          </div>

          <div className="flex gap-3 text-sm">
            <button
              onClick={() => navigate("/admin")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/admin/doctor-requests")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Doctor Requests
            </button>

            <button
              onClick={() => navigate("/admin?view=auditLogs")}
              className="hover:bg-slate-800 px-2.5 py-1 rounded"
            >
              Audit Logs
            </button>

            <SecureFilesButton />
            <NotificationBell />

            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-sm"
            >
              Logout
            </button>
          </div>

        </div>
      </nav>
    );
  }

  return null;
};

export default Navbar;