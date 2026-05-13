import { Link } from "react-router-dom";

function Home() {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  return (
    <div className="flex flex-col items-center min-h-screen bg-slate-50 p-6">

      {/* Main container */}
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl text-center overflow-hidden">

        {/* Hero section */}
        <div className="px-10 pt-12 pb-10 border-b border-slate-100">

          {/* Pill badge */}
          <div className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full border border-sky-200 bg-sky-50 text-sky-700 mb-6">
            Secure health management
          </div>

          <h1 className="text-4xl font-bold text-[#0f2744] mb-4 tracking-tight">
            Securely manage your chronic health
          </h1>

          <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-xl mx-auto">
            A privacy-first platform for patients, doctors, and administrators.
            ChronicPal supports symptom tracking, secure medical file sharing,
            and personal health insights - built with strong cybersecurity practices.
          </p>

          {/* When user is NOT logged in */}
          {!token && (
            <div className="flex justify-center gap-3 mb-2">
              <Link
                to="/login"
                className="px-6 py-2.5 bg-[#0f2744] text-white rounded-lg hover:bg-[#1e3a5f] text-sm font-medium transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="px-6 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-400 text-sm font-medium transition-colors"
              >
                Register
              </Link>
            </div>
          )}

          {/* When logged in - guide users to dashboard */}
          {token && (
            <div className="flex flex-col items-center mb-2">

              {role === "admin" && (
                <Link
                  to="/admin"
                  className="px-6 py-2.5 bg-[#0f2744] text-white rounded-lg hover:bg-[#1e3a5f] w-56 text-center text-sm font-medium transition-colors"
                >
                  Go to Admin Dashboard
                </Link>
              )}

              {role === "doctor" && (
                <Link
                  to="/doctor"
                  className="px-6 py-2.5 bg-[#0f2744] text-white rounded-lg hover:bg-[#1e3a5f] w-56 text-center text-sm font-medium transition-colors"
                >
                  Go to Doctor Dashboard
                </Link>
              )}

              {role === "patient" && (
                <Link
                  to="/patient"
                  className="px-6 py-2.5 bg-[#0f2744] text-white rounded-lg hover:bg-[#1e3a5f] w-56 text-center text-sm font-medium transition-colors"
                >
                  Go to Patient Dashboard
                </Link>
              )}
            </div>
          )}

        </div>

        {/* Secure by Design */}
        <div className="px-10 py-10 border-b border-slate-100 text-left">

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500 mb-2">Security</p>
          <h2 className="text-2xl font-bold text-[#0f2744] mb-6">
            Secure by design
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-[#0f2744] mb-1 text-sm">
                Role-based access control
              </h3>
              <p className="text-sm text-slate-500">
                Patients, doctors, and administrators can only access features
                appropriate to their role.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-[#0f2744] mb-1 text-sm">
                Encrypted medical files
              </h3>
              <p className="text-sm text-slate-500">
                All uploaded files are scanned by ClamAV and encrypted before
                storage to protect sensitive medical data.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-[#0f2744] mb-1 text-sm">
                Audit logging and monitoring
              </h3>
              <p className="text-sm text-slate-500">
                Security-relevant actions are logged across the platform to
                support accountability and threat detection.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h3 className="font-semibold text-[#0f2744] mb-1 text-sm">
                Multi-factor authentication
              </h3>
              <p className="text-sm text-slate-500">
                MFA is enforced for admin and doctor accounts, and available
                for patients via TOTP setup as an extra layer of protection.
              </p>
            </div>

          </div>
        </div>

        {/* Who is ChronicPal for */}
        <div className="px-10 py-10 border-b border-slate-100 text-left">

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500 mb-2">Who it's for</p>
          <h2 className="text-2xl font-bold text-[#0f2744] mb-6">
            Built for every role
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mb-3 inline-block">
                Patients
              </span>
              <p className="text-sm text-slate-500">
                Track symptoms, log food and medication, view personal health
                summaries and trend insights, and securely access medical records.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 mb-3 inline-block">
                Doctors
              </span>
              <p className="text-sm text-slate-500">
                Manage assigned patients, review logs and aggregated summaries,
                upload clinical files, and add notes to patient histories.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 mb-3 inline-block">
                Administrators
              </span>
              <p className="text-sm text-slate-500">
                Oversee system security, view system statistics, review audit
                logs, and manage doctor account creation.
              </p>
            </div>

          </div>
        </div>

        {/* Platform features */}
        <div className="px-10 py-10 border-b border-slate-100 text-left">

          <p className="text-xs font-semibold uppercase tracking-widest text-sky-500 mb-2">Features</p>
          <h2 className="text-2xl font-bold text-[#0f2744] mb-6">
            Secure tools for tracking, insights, and clinical support
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

            {[
              "Symptom and health tracking",
              "Secure file uploads and downloads",
              "Food and medication logging",
              "Personal health trend summaries",
              "Encrypted data storage",
              "Audit logging and compliance",
              "Possible trigger pattern detection",
              "Doctor access management",
              "MFA and JWT authentication",
            ].map((feature) => (
              <div key={feature} className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
                {feature}
              </div>
            ))}

          </div>

        </div>

        {/* Footer */}
        <div className="px-10 py-5 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            ChronicPal © 2025
          </p>
          <p className="text-xs text-slate-400">
            Security-first design - OWASP-aligned development practices
          </p>
        </div>

      </div>
    </div>
  );
}

export default Home;