import React from "react";

// Patient placeholder cards for midpoint demo
function PatientDashboard() {
  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">

      <h1 className="text-3xl font-bold mb-4">Patient Dashboard</h1>

      <p className="text-slate-700 mb-8">
        Welcome. Use this dashboard to manage your daily health data and view personalised insights.
      </p>

      {/* Patient tool cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Manage Profile */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">My Health Profile</h2>
          <p className="text-sm text-slate-600 mt-1">
            View and update your personal health information such as conditions and allergies.
          </p>

          <button
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
          >
            Manage Profile
          </button>
        </div>

        {/* ------ Symptoms Log ----- */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Symptoms Log</h2>
          <p className="text-sm text-slate-600 mt-1">
            Track daily symptoms to help monitor condition trends.
          </p>

          <button
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
          >
            Log Symptoms
          </button>
        </div>

        {/* ---- Food/Medication Log ------*/}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Food & Medication</h2>
          <p className="text-sm text-slate-600 mt-1">
            Record food intake or medications taken today.
          </p>

          <button
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
          >
            Log Food / Medication
          </button>
        </div>

        {/*---- AI Insights --- */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">AI Insights</h2>
          <p className="text-sm text-slate-600 mt-1">
            Placeholder for AI-powered trend detection and predictive health insights.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            More data required before insights can be generated.
          </p>
        </div>

        {/* ---- Notifications---- */}
        <div className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-slate-600 mt-1">
            Placeholder for real-time system alerts and reminders (Socket.io planned).
          </p>
        </div>

      </div>

    </div>
  );
}

export default PatientDashboard;