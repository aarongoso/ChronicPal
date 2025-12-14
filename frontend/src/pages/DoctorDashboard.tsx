import React from "react";
// no functionality yet only designed for midpoint demo

function DoctorDashboard() {
  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">

      <h1 className="text-3xl font-bold mb-4">Doctor Dashboard</h1>

      <p className="text-slate-700 mb-8">
        Welcome. Use this dashboard to review patient information and clinical updates.
      </p>

      {/* Doctor tool cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Assigned Patients */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Assigned Patients</h2>
          <p className="text-sm text-slate-600 mt-1">
            View patients assigned to you and access their medical records.
          </p>
        </div>

        {/* Patient History */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Patient History</h2>
          <p className="text-sm text-slate-600 mt-1">
            Review symptom logs, uploaded results, and historical notes.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Access is restricted to assigned patients only (RBAC enforced).
          </p>
        </div>

        {/* Notifications */}
        <div className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-slate-600 mt-1">
            Placeholder for real-time clinical alerts and appointment updates
            (Socket.io planned).
          </p>
        </div>

      </div>
    </div>
  );
}

export default DoctorDashboard;