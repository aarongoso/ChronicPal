import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../services/Api";

// Role based navigation bar
// It shows different links for public users, patients, doctors, and admins

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  // logout handler
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
      navigate("/login");
    }
  };

  // Returns active style if current path matches
  const navBtnClass = (path: string) =>
    `px-2.5 py-1 rounded text-sm transition-colors ${
      location.pathname === path
        ? "bg-[#1e3a5f] text-white"
        : "text-slate-300 hover:bg-[#1e3a5f] hover:text-white"
    }`;

  // PUBLIC NAVBAR (not logged in) ---------------------------
  if (!token || !role) {
    return (
      <nav className="bg-[#0f2744] text-white border-b border-[#1e3a5f]">
        <div className="mx-auto max-w-6xl relative flex items-center justify-between px-4 py-2">

          <Link to="/" className="text-xl font-semibold">
            ChronicPal
          </Link>

          {/* Centred links */}
          <div className="absolute left-1/2 -translate-x-1/2 flex gap-3 text-sm">
            <Link to="/" className={navBtnClass("/")}>
              Home
            </Link>
          </div>

          <div className="flex gap-3 text-sm">
            <Link
              to="/login"
              className="border border-[#4a6fa5] hover:bg-[#1e3a5f] px-2.5 py-1 rounded"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="bg-sky-500 hover:bg-sky-400 px-2.5 py-1 rounded"
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
      className={navBtnClass("/upload")}
    >
      Secure Files
    </button>
  );

  // Not yet implemented potential future feature
  // const NotificationBell = () => (
  //   <button
  //     onClick={() =>
  //       alert("Notifications placeholder TODO")
  //     }
  //     className="px-2 py-1 rounded hover:bg-slate-800"
  //     title="Notifications"
  //   >
  //     <img src={notificationIcon} alt="" className="h-5 w-5" />
  //   </button>
  // );

  // PATIENT NAVBAR ---------------------------
  if (role === "patient") {
    return (
      <nav className="bg-[#0f2744] text-white border-b border-[#1e3a5f]">
        <div className="mx-auto max-w-6xl relative flex items-center justify-between px-4 py-2">

          <div
            className="text-xl font-semibold cursor-pointer"
            onClick={() => navigate("/")}
          >
            ChronicPal
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 ml-2">
              Patient
            </span>
          </div>

          {/* Centred links */}
          <div className="absolute left-1/2 -translate-x-1/2 flex gap-3 text-sm">
            <button onClick={() => navigate("/patient")} className={navBtnClass("/patient")}>
              Dashboard
            </button>
            <button onClick={() => navigate("/patient/insights")} className={navBtnClass("/patient/insights")}>
              Insights
            </button>
            <button onClick={() => navigate("/patient/log?tab=symptoms")} className={navBtnClass("/patient/log")}>
              Daily Log
            </button>

            <SecureFilesButton />
            {/* Not yet implemented potential future feature */}
            {/* <NotificationBell /> */}
          </div>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded bg-transparent text-red-300 border border-red-900 hover:bg-red-950 text-sm"
          >
            Logout
          </button>

        </div>
      </nav>
    );
  }

  // DOCTOR NAVBAR -------------------------------------------
  if (role === "doctor") {
    return (
      <nav className="bg-[#0f2744] text-white border-b border-[#1e3a5f]">
        <div className="mx-auto max-w-6xl relative flex items-center justify-between px-4 py-2">

          <div
            className="text-xl font-semibold cursor-pointer"
            onClick={() => navigate("/")}
          >
            ChronicPal
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 ml-2">
              Doctor
            </span>
          </div>

          {/* Centred links */}
          <div className="absolute left-1/2 -translate-x-1/2 flex gap-3 text-sm">
            <button onClick={() => navigate("/doctor")} className={navBtnClass("/doctor")}>
              Dashboard
            </button>
            <button onClick={() => navigate("/doctor/assigned-patients")} className={navBtnClass("/doctor/assigned-patients")}>
              Assigned Patients
            </button>

            <SecureFilesButton />
            {/* Not yet implemented potential future feature */}
            {/* <NotificationBell /> */}
          </div>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded bg-transparent text-red-300 border border-red-900 hover:bg-red-950 text-sm"
          >
            Logout
          </button>

        </div>
      </nav>
    );
  }

  // ADMIN NAVBAR ---------------------
  if (role === "admin") {
    return (
      <nav className="bg-[#0f2744] text-white border-b border-[#1e3a5f]">
        <div className="mx-auto max-w-6xl relative flex items-center justify-between px-4 py-2">

          <div
            className="text-xl font-semibold cursor-pointer"
            onClick={() => navigate("/")}
          >
            ChronicPal
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 ml-2">
              Admin
            </span>
          </div>

          {/* Centred links */}
          <div className="absolute left-1/2 -translate-x-1/2 flex gap-3 text-sm">
            <button onClick={() => navigate("/admin")} className={navBtnClass("/admin")}>
              Dashboard
            </button>
            <button onClick={() => navigate("/admin/doctor-requests")} className={navBtnClass("/admin/doctor-requests")}>
              Doctor Requests
            </button>
            <button onClick={() => navigate("/admin?view=auditLogs")} className={navBtnClass("/admin/audit-logs")}>
              Audit Logs
            </button>

            <SecureFilesButton />
            {/* Not yet implemented potential future feature */}
            {/* <NotificationBell /> */}
          </div>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 rounded bg-transparent text-red-300 border border-red-900 hover:bg-red-950 text-sm"
          >
            Logout
          </button>

        </div>
      </nav>
    );
  }

  return null;
};

export default Navbar;