import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDoctorAssignedPatients } from "../services/Api";

type AssignedPatient = {
  id: number;
  patientId: number;
  patientEmail: string | null;
  status: "ACTIVE";
  updatedAt: string;
};

function DoctorAssignedPatients() {
  const navigate = useNavigate();
  const [assignedPatients, setAssignedPatients] = useState<AssignedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Fetch ACTIVE assigned patients for the logged in doctor
    // RBAC and assignment checks are enforced by the backend, this page just displays the result
    let mounted = true;

    const loadAssignedPatients = async () => {
      try {
        setLoading(true);
        const res = await getDoctorAssignedPatients();
        if (!mounted) return;
        setAssignedPatients(res.assignments || []);
      } catch (err: any) {
        if (!mounted) return;
        setMessage(err?.error || "Could not load assigned patients.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadAssignedPatients();

    // Prevents state updates if the component unmounts before the async request finishes
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h1 className="text-2xl font-bold">Assigned Patients</h1>
        <p className="text-sm text-slate-600 mt-1">
          Active patient assignments for this doctor.
        </p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        {message ? <p className="text-sm text-slate-700 mb-4">{message}</p> : null}

        {loading ? (
          <p className="text-sm text-slate-600">Loading assigned patients...</p>
        ) : assignedPatients.length === 0 ? (
          <p className="text-sm text-slate-600">No active assigned patients.</p>
        ) : (
          <div className="space-y-3">
            {assignedPatients.map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between gap-4 p-4 border rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {patient.patientEmail || `Patient #${patient.patientId}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    Status: {patient.status} | Updated{" "}
                    {new Date(patient.updatedAt).toLocaleString()}
                  </p>
                </div>

                <button
                  className="px-3 py-2 text-sm bg-slate-900 text-white rounded hover:bg-slate-800"
                  onClick={() => navigate(`/doctor/patients/${patient.patientId}/history`)}
                >
                  View History
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DoctorAssignedPatients;
