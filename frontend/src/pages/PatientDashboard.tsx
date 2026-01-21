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

  <p className="text-sm text-slate-600 mt-1 mb-3">
    Track daily symptoms to help monitor condition trends.
  </p>

  {/* Recently logged symptoms (placeholder) */}
  <ul className="text-sm text-slate-700 space-y-2 mb-4">
    <li className="flex justify-between">
      <span>Fatigue</span>
      <span className="text-xs text-slate-500">Today</span>
    </li>
    <li className="flex justify-between">
      <span>Joint Pain (Moderate)</span>
      <span className="text-xs text-slate-500">Yesterday</span>
    </li>
    <li className="flex justify-between">
      <span>Headache</span>
      <span className="text-xs text-slate-500">2 days ago</span>
    </li>
  </ul>

  <button
    className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
  >
    Log Symptoms
  </button>
</div>

        {/* ---- Food/Medication Log ------*/}
<div className="bg-white p-6 rounded-xl shadow">
  <h2 className="text-lg font-semibold">Food & Medication</h2>

  <p className="text-sm text-slate-600 mt-1 mb-4">
    Record food intake and medications taken throughout the day.
  </p>

  {/* Medication section */}
  <div className="mb-4">
    <h3 className="text-sm font-semibold text-slate-700 mb-2">
      Recent Medications
    </h3>

    <ul className="text-sm text-slate-700 space-y-2">
      <li className="flex justify-between">
        <span>Ibuprofen 200mg</span>
        <span className="text-xs text-slate-500">Morning</span>
      </li>
      <li className="flex justify-between">
        <span>Paracetamol 500mg</span>
        <span className="text-xs text-slate-500">Afternoon</span>
      </li>
      <li className="flex justify-between">
        <span>Vitamin D</span>
        <span className="text-xs text-slate-500">Yesterday</span>
      </li>
    </ul>
  </div>

  {/* Food section */}
  <div className="mb-4">
    <h3 className="text-sm font-semibold text-slate-700 mb-2">
      Recent Meals
    </h3>

    <ul className="text-sm text-slate-700 space-y-2">
      <li className="flex justify-between">
        <span>Oatmeal & Fruit</span>
        <span className="text-xs text-slate-500">Breakfast</span>
      </li>
      <li className="flex justify-between">
        <span>Chicken & Rice</span>
        <span className="text-xs text-slate-500">Lunch</span>
      </li>
      <li className="flex justify-between">
        <span>Salmon & Vegetables</span>
        <span className="text-xs text-slate-500">Dinner</span>
      </li>
    </ul>
  </div>

  <button
    className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
  >
    Log Food / Medication
  </button>
</div>

        {/*---- AI Insights --- */}

<div className="bg-white p-6 rounded-xl shadow">
  <h2 className="text-lg font-semibold">AI Insights</h2>

  <p className="text-sm text-slate-600 mt-1 mb-4">
    Placeholder visualisation for AI-generated health trends.
    Insights will appear once sufficient data has been logged.
  </p>

  {/* Placeholder chart */}
  <div className="space-y-3">
    <div>
      <p className="text-xs text-slate-500 mb-1">Flare-up Risk (Last 7 Days)</p>
      <div className="w-full bg-slate-200 rounded h-3">
        <div className="bg-blue-600 h-3 rounded" style={{ width: "65%" }}></div>
      </div>
    </div>

    <div>
      <p className="text-xs text-slate-500 mb-1">Medication Consistency</p>
      <div className="w-full bg-slate-200 rounded h-3">
        <div className="bg-emerald-600 h-3 rounded" style={{ width: "80%" }}></div>
      </div>
    </div>

    <div>
      <p className="text-xs text-slate-500 mb-1">Symptom Stability</p>
      <div className="w-full bg-slate-200 rounded h-3">
        <div className="bg-amber-500 h-3 rounded" style={{ width: "45%" }}></div>
      </div>
    </div>
  </div>

  {/* View more button */}
  <button
    className="mt-5 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
    onClick={() =>
      alert(
        "Detailed AI insights will be available once more data is collected. This feature will be expanded after the midpoint."
      )
    }
  >
    View Detailed Insights
  </button>

  <p className="text-xs text-slate-400 mt-3">
    AI analysis is informational only and does not replace professional medical advice.
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