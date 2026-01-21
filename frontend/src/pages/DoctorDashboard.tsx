import React from "react";
// no functionality yet only designed for midpoint demo

function DoctorDashboard() {
  // placeholder appointment data for midpoint demo only
  const upcomingAppointments = [
    {
      day: "Mon",
      date: "18 Mar",
      time: "09:00",
      patient: "Mary (Demo)",
      reason: "Follow-up",
    },
    {
      day: "Mon",
      date: "18 Mar",
      time: "11:30",
      patient: "John (Demo)",
      reason: "Blood results",
    },
    {
      day: "Tue",
      date: "19 Mar",
      time: "10:00",
      patient: "Sarah (Demo)",
      reason: "MRI Scan",
    },
  ];

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
  <p className="text-sm text-slate-600 mt-1 mb-4">
    Select a patient to view their medical history and records.
  </p>

  {/* scrollable patient list placeholder */}
  <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
    {[
      { name: "Mary O'Brien", condition: "Diabetes Type 2" },
      { name: "John Murphy", condition: "Crohn’s Disease" },
      { name: "Sarah Kelly", condition: "Rheumatoid Arthritis" },
      { name: "Tom Walsh", condition: "Asthma" },
      { name: "Emma Byrne", condition: "Endometriosis" },
    ].map((patient, idx) => (
      <div
        key={idx}
        className="flex items-center justify-between p-3 border rounded-lg"
      >
        <div>
          <p className="font-medium">{patient.name}</p>
          <p className="text-xs text-slate-500">{patient.condition}</p>
        </div>

        <button
          className="px-3 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800"
          // placeholder only — real navigation added after midpoint
        >
          View Patient
        </button>
      </div>
    ))}
  </div>

  <p className="text-xs text-slate-500 mt-4">
    Doctors can only access patients explicitly assigned to them (RBAC).
  </p>
</div>

{/* Patient History */}
<div className="bg-white p-5 rounded-xl shadow">
  <h2 className="text-lg font-semibold">Patient History</h2>

  <p className="text-sm text-slate-600 mt-1 mb-3">
    Review a selected patient’s medical timeline and clinical records.
  </p>

  {/* Patient selector (non-functional placeholder) */}
  <div className="mb-3">
    <label className="block text-xs font-medium text-slate-600 mb-1">
      Select Patient
    </label>

    <select
      className="w-full border rounded px-2.5 py-1.5 text-sm bg-slate-50 cursor-not-allowed"
      disabled
    >
      <option>— Select an assigned patient —</option>
      <option>Mary O’Brien</option>
      <option>John Kelly</option>
      <option>Sarah Byrne</option>
    </select>

    <p className="text-xs text-slate-500 mt-1">
      Placeholder — patient context applied after midpoint
    </p>
  </div>

  {/* Scrollable history timeline */}
  <div className="max-h-40 overflow-y-auto space-y-3 border rounded p-3 bg-slate-50">
    <div className="border-l-4 border-blue-600 pl-3">
      <p className="text-xs text-slate-500">15 Mar 2025</p>
      <p className="text-sm font-medium">Symptom Logged</p>
      <p className="text-xs text-slate-600">
        Fatigue level increased (7/10)
      </p>
    </div>

    <div className="border-l-4 border-emerald-600 pl-3">
      <p className="text-xs text-slate-500">14 Mar 2025</p>
      <p className="text-sm font-medium">Lab Result Uploaded</p>
      <p className="text-xs text-slate-600">
        Blood test results uploaded
      </p>
    </div>

    <div className="border-l-4 border-purple-600 pl-3">
      <p className="text-xs text-slate-500">12 Mar 2025</p>
      <p className="text-sm font-medium">Clinical Note</p>
      <p className="text-xs text-slate-600">
        Patient reports improved appetite
      </p>
    </div>
  </div>
</div>



        {/* Manage Appointments */}
        <div className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Manage Appointments</h2>
              <p className="text-sm text-slate-600 mt-1">
                Calendar-style view of upcoming appointments (placeholder).
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Schedule & Manage Appointments — backend logic added after midpoint.
              </p>
            </div>

            <button
              className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
              onClick={() =>
                alert("Appointment management placeholder for midpoint demo")
              }
            >
              Open Calendar
            </button>
          </div>

          {/* Fake calendar table */}
          <div className="mt-4 border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-50 text-xs font-semibold text-slate-600 border-b">
              <div className="col-span-2 p-3">Day</div>
              <div className="col-span-2 p-3">Date</div>
              <div className="col-span-2 p-3">Time</div>
              <div className="col-span-3 p-3">Patient</div>
              <div className="col-span-3 p-3">Reason</div>
            </div>

            {upcomingAppointments.map((appt, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 text-sm border-b last:border-b-0"
              >
                <div className="col-span-2 p-3">{appt.day}</div>
                <div className="col-span-2 p-3">{appt.date}</div>
                <div className="col-span-2 p-3">{appt.time}</div>
                <div className="col-span-3 p-3">{appt.patient}</div>
                <div className="col-span-3 p-3">{appt.reason}</div>
              </div>
            ))}
          </div>
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