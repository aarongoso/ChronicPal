import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  acceptDoctorAccessRequest,
  getDoctorAssignedPatients,
  getDoctorAccessRequests,
  rejectDoctorAccessRequest,
} from "../services/Api";

type AssignedPatient = {
  id: number;
  patientId: number;
  patientEmail: string | null;
  status: "ACTIVE";
  updatedAt: string;
};

type DoctorAssignmentRequest = {
  id: number;
  patientId: number;
  patientEmail: string | null;
  status: "PENDING";
  createdAt: string;
};

function DoctorDashboard() {
  const navigate = useNavigate();
  const [assignedPatients, setAssignedPatients] = useState<AssignedPatient[]>([]);
  const [requests, setRequests] = useState<DoctorAssignmentRequest[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState<boolean>(true);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(true);
  const [assignmentStatus, setAssignmentStatus] = useState<string>("");

  /* Not yet implemented potential future feature
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
  */

  const loadAssignedPatients = async () => {
    try {
      setLoadingAssigned(true);
      const res = await getDoctorAssignedPatients();
      setAssignedPatients(res.assignments || []);
    } catch (err: any) {
      setAssignmentStatus("Could not load assigned patients.");
    } finally {
      setLoadingAssigned(false);
    }
  };

  const loadRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await getDoctorAccessRequests();
      setRequests(res.requests || []);
    } catch (err: any) {
      setAssignmentStatus("Could not load doctor assignment requests.");
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadAssignedPatients();
    loadRequests();
  }, []);

  const handleAccept = async (assignmentId: number) => {
    try {
      const res = await acceptDoctorAccessRequest(assignmentId);
      setAssignmentStatus(res.message || "Assignment request accepted.");
      await loadAssignedPatients();
      await loadRequests();
    } catch (err: any) {
      setAssignmentStatus(err?.error || "Could not accept assignment request.");
    }
  };

  const handleReject = async (assignmentId: number) => {
    try {
      const res = await rejectDoctorAccessRequest(assignmentId);
      setAssignmentStatus(res.message || "Assignment request rejected.");
      await loadRequests();
    } catch (err: any) {
      setAssignmentStatus(err?.error || "Could not reject assignment request.");
    }
  };

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
    Active patient assignments for this doctor.
  </p>

  {assignmentStatus ? (
    <p className="text-sm text-slate-700 mb-4">{assignmentStatus}</p>
  ) : null}

  <div className="max-h-48 overflow-y-auto space-y-3 pr-1">
    {loadingAssigned ? (
      <p className="text-sm text-slate-600">Loading assigned patients...</p>
    ) : assignedPatients.length === 0 ? (
      <p className="text-sm text-slate-600">No active assigned patients.</p>
    ) : (
      assignedPatients.map((patient) => (
        <div
          key={patient.id}
          className="flex items-center justify-between p-3 border rounded-lg"
        >
          <div>
            <p className="font-medium">{patient.patientEmail || `Patient #${patient.patientId}`}</p>
            <p className="text-xs text-slate-500">
              Status: {patient.status} | Updated {new Date(patient.updatedAt).toLocaleString()}
            </p>
          </div>

          <button
            className="px-3 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800"
            onClick={() => navigate(`/doctor/patients/${patient.patientId}/history`)}
          >
            View Patient
          </button>
        </div>
      ))
    )}
  </div>

  <p className="text-xs text-slate-500 mt-4">
    Doctors can only access patients explicitly assigned to them (RBAC).
  </p>
</div>

{/* Doctor Assignment Requests */}
<div className="bg-white p-5 rounded-xl shadow">
  <h2 className="text-lg font-semibold">Doctor Assignment Requests</h2>

  <p className="text-sm text-slate-600 mt-1 mb-3">
    Review pending patient assignment requests.
  </p>

  <div className="max-h-40 overflow-y-auto space-y-3 border rounded p-3 bg-slate-50">
    {loadingRequests ? (
      <p className="text-sm text-slate-600">Loading assignment requests...</p>
    ) : requests.length === 0 ? (
      <p className="text-sm text-slate-600">No pending assignment requests.</p>
    ) : (
      requests.map((request) => (
        <div
          key={request.id}
          className="flex items-center justify-between gap-3 border rounded-lg p-3 bg-white"
        >
          <div>
            <p className="font-medium">{request.patientEmail || `Patient #${request.patientId}`}</p>
            <p className="text-xs text-slate-500">
              Pending since {new Date(request.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className="px-3 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800"
              onClick={() => handleAccept(request.id)}
            >
              Accept
            </button>
            <button
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
              onClick={() => handleReject(request.id)}
            >
              Reject
            </button>
          </div>
        </div>
      ))
    )}
  </div>
</div>



        {/* Not yet implemented potential future feature
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

          Fake calendar table
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
        */}

        {/* Not yet implemented potential future feature
        <div className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-slate-600 mt-1">
            Placeholder for real-time clinical alerts and appointment updates
            (Socket.io planned).
          </p>
        </div>
        */}

      </div>
    </div>
  );
}

export default DoctorDashboard;