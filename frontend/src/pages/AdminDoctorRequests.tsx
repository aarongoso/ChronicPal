import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/Api";

// Admin page for reviewing pending doctor account requests

type DoctorRequest = {
  id: number;
  fullName: string;
  email: string;
  clinicOrHospital: string;
  licenseNumber: string;
  createdAt: string;
};

const AdminDoctorRequests: React.FC = () => {
  // Admin list view for doctor onboarding requests (pending only)
  // Backend enforces RBAC + audit logging
  const [requests, setRequests] = useState<DoctorRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch pending requests from the admin endpoint
      const res = await api.get("/admin/doctor-requests?status=PENDING");
      setRequests(res.data?.requests || []);
    } catch {
      setError("Failed to load doctor requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Pending Doctor Requests</h2>
          <button
            onClick={fetchRequests}
            className="bg-[#0f2744] text-white px-4 py-2 rounded hover:bg-[#1e3a5f]"
          >
            Refresh
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          Doctor onboarding is handled here: approving a request generates an activation
          token that must be shared out-of-band (no email or external sources trusted).
        </p>

        {loading && <p className="text-slate-500">Loading...</p>}
        {error && <p className="text-red-600 mb-3">{error}</p>}

        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Full Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Clinic/Hospital</th>
                <th className="text-left px-4 py-3">License</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-t">
                  <td className="px-4 py-3">{req.fullName}</td>
                  <td className="px-4 py-3">{req.email}</td>
                  <td className="px-4 py-3">{req.clinicOrHospital}</td>
                  <td className="px-4 py-3">{req.licenseNumber}</td>
                  <td className="px-4 py-3">
                    {req.createdAt ? new Date(req.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {/* Navigate to detail page where approve/reject actions live */}
                    <Link
                      to={`/admin/doctor-requests/${req.id}`}
                      className="text-sky-500 hover:text-sky-400"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {!loading && requests.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    No pending requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDoctorRequests;