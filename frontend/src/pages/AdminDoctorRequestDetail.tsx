import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/Api";

type DoctorRequestDetail = {
  id: number;
  fullName: string;
  email: string;
  clinicOrHospital: string;
  licenseNumber: string;
  notes?: string | null;
  status: string;
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  doctorUserId?: number | null;
  activationTokenExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const AdminDoctorRequestDetail: React.FC = () => {
  // id comes from the route param: /admin/doctor-requests/:id
  const { id } = useParams();
  const navigate = useNavigate();

  // Admin only view: shows one request and provides approve/reject actions
  const [request, setRequest] = useState<DoctorRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // activationToken is only returned by the approve endpoint once
  // (backend stores only a hash + expiry, so the UI must display/copy it immediately)
  const [activationToken, setActivationToken] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/admin/doctor-requests/${id}`);
      setRequest(res.data);
    } catch {
      setError("Failed to load request.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Refresh detail page when id changes (navigating between requests)
    fetchRequest();
  }, [fetchRequest]);

  const handleApprove = async () => {
    if (!id) return;
    setError("");
    setMessage("");
    setCopyStatus("");
    try {
      // Approve creates doctor user + generates activation token (returned once)
      const res = await api.post(`/admin/doctor-requests/${id}/approve`);
      const token = res.data?.activationToken || "";
      setActivationToken(token);
      setMessage("Approved. Share the activation token securely.");
      fetchRequest(); // reload status fields (APPROVED, reviewedBy, reviewedAt, expiry)
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to approve request.");
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setError("");
    setMessage("");
    try {
      // Reject updates request status, UI returns to list after
      await api.post(`/admin/doctor-requests/${id}/reject`);
      setMessage("Request rejected. Returning to list...");
      setTimeout(() => navigate("/admin/doctor-requests"), 1000);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to reject request.");
    }
  };

  const handleCopy = async () => {
    if (!activationToken) return;
    try {
      // Clipboard API used so admin can paste into a secure channel (no email in app)
      await navigator.clipboard.writeText(activationToken);
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Copy failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-6">
      <div className="max-w-3xl mx-auto bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Doctor Request Detail</h2>
          <button
            onClick={() => navigate("/admin/doctor-requests")}
            className="text-blue-600 hover:underline text-sm"
          >
            Back to list
          </button>
        </div>

        {loading && <p className="text-gray-600">Loading...</p>}
        {error && <p className="text-red-600 mb-3">{error}</p>}
        {message && <p className="text-green-700 mb-3">{message}</p>}

        {request && (
          <div className="space-y-3 text-sm">
            <div>
              <span className="font-semibold">Full Name:</span> {request.fullName}
            </div>
            <div>
              <span className="font-semibold">Email:</span> {request.email}
            </div>
            <div>
              <span className="font-semibold">Clinic/Hospital:</span>{" "}
              {request.clinicOrHospital}
            </div>
            <div>
              <span className="font-semibold">License Number:</span>{" "}
              {request.licenseNumber}
            </div>
            <div>
              <span className="font-semibold">Notes:</span> {request.notes || "-"}
            </div>
            <div>
              <span className="font-semibold">Status:</span> {request.status}
            </div>
            <div>
              <span className="font-semibold">Created:</span>{" "}
              {request.createdAt ? new Date(request.createdAt).toLocaleString() : "-"}
            </div>
            <div>
              <span className="font-semibold">Reviewed By:</span> {request.reviewedBy || "-"}
            </div>
            <div>
              <span className="font-semibold">Reviewed At:</span>{" "}
              {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString() : "-"}
            </div>
            <div>
              <span className="font-semibold">Doctor User ID:</span> {request.doctorUserId || "-"}
            </div>
            <div>
              <span className="font-semibold">Token Expires:</span>{" "}
              {request.activationTokenExpiresAt
                ? new Date(request.activationTokenExpiresAt).toLocaleString()
                : "-"}
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleApprove}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Reject
          </button>
        </div>

        {activationToken && (
          <div className="mt-6">
            <p className="text-sm font-semibold mb-2">Activation Token</p>
            <div className="bg-gray-100 border rounded p-3 font-mono text-xs break-all">
              {activationToken}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Share this token with the doctor via a secure channel. Token expires at{" "}
              {request?.activationTokenExpiresAt
                ? new Date(request.activationTokenExpiresAt).toLocaleString()
                : "-"}
              .
            </p>
            <button
              onClick={handleCopy}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Copy
            </button>
            {copyStatus && <p className="text-xs text-gray-600 mt-1">{copyStatus}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDoctorRequestDetail;