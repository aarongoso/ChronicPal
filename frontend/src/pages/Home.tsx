import { Link } from "react-router-dom";

function Home() {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-100 p-6">

      {/* Main container */}
      <div className="bg-white shadow-lg rounded-2xl p-10 w-full max-w-4xl text-center">

        <h1 className="text-4xl font-bold text-slate-900 mb-4">ChronicPal</h1>

        <p className="text-slate-700 text-lg leading-relaxed mb-8">
          A secure, role-based healthcare platform designed for patients, doctors,
          and administrators. ChronicPal supports symptom tracking, medical file
          sharing, and appointment management — built with strong cybersecurity
          practices and privacy in mind.
        </p>

        {/* When user is NOT logged in */}
        {!token && (
          <div className="flex justify-center gap-4 mb-12">
            <Link
              to="/login"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Login
            </Link>

            <Link
              to="/register"
              className="px-6 py-2 bg-gray-300 text-black rounded-lg hover:bg-gray-400"
            >
              Register
            </Link>
          </div>
        )}

        {/* When logged in – guide users to dashboard */}
        {token && (
          <div className="flex flex-col items-center mb-12">

            {role === "admin" && (
              <Link
                to="/admin"
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 w-56 text-center"
              >
                Go to Admin Dashboard
              </Link>
            )}

            {role === "doctor" && (
              <Link
                to="/doctor"
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 w-56 text-center"
              >
                Go to Doctor Dashboard
              </Link>
            )}

            {role === "patient" && (
              <Link
                to="/patient"
                className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 w-56 text-center"
              >
                Go to Patient Dashboard
              </Link>
            )}
          </div>
        )}

        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Secure by Design
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 text-left">

          <div className="bg-slate-50 p-5 rounded-xl border">
            <h3 className="font-semibold text-slate-900 mb-1">
              Role-Based Access Control (RBAC)
            </h3>
            <p className="text-sm text-slate-600">
              Patients, doctors, and administrators can only access features
              appropriate to their role.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border">
            <h3 className="font-semibold text-slate-900 mb-1">
              Encrypted Medical Files
            </h3>
            <p className="text-sm text-slate-600">
              All uploaded files are scanned and encrypted before storage to
              protect sensitive medical data.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border">
            <h3 className="font-semibold text-slate-900 mb-1">
              Audit Logging & Monitoring
            </h3>
            <p className="text-sm text-slate-600">
              System actions are logged to support accountability, auditing,
              and threat detection.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border">
            <h3 className="font-semibold text-slate-900 mb-1">
              MFA-Ready Authentication
            </h3>
            <p className="text-sm text-slate-600">
              Designed to support multi-factor authentication and secure
              session handling.
            </p>
          </div>

        </div>


        {/* --- Who its this for --- */}
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Who Is ChronicPal For?
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Patients</h3>
            <p className="text-sm text-slate-600">
              Track symptoms, log food and medication, manage appointments,
              and securely access personal medical records.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Doctors</h3>
            <p className="text-sm text-slate-600">
              Manage assigned patients, upload clinical results, review
              patient histories, and coordinate care.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Administrators</h3>
            <p className="text-sm text-slate-600">
              Oversee system security, manage users and roles, review audit
              logs, and approve doctor access requests.
            </p>
          </div>

        </div>

        {/* ----- Platofrm features ------ */}
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          Platform Features
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">

          <div className="bg-slate-50 p-4 rounded-lg border text-sm">
            Symptom & Health Tracking
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-sm">
            Secure File Uploads & Downloads
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-sm">
            Appointment Management
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-sm">
            AI Insights (Planned)
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-sm">
            Encrypted Data Storage
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border text-sm">
            Audit Logging & Compliance
          </div>

        </div>

        {/* Footer */}
        <p className="text-xs text-slate-500 mt-6">
          ChronicPal © 2025 - Built with security-first design - OWASP-aligned
          development practices
        </p>

      </div>
    </div>
  );
}

export default Home;