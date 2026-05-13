import React, { useEffect, useState } from "react";
import api from "../services/Api";

// can view audit logs, filter logs and see security critical events
function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // added pagination + sorting
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const [filters, setFilters] = useState({
    action: "",
    userId: "",
    start: "",
    end: "",
  });

  // Fetch logs from backend
  const fetchLogs = async () => {
    setLoading(true);

    try {
      // Only send filters that actually have values
      const activeFilters: any = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== "") activeFilters[key] = value;
      });

      const res = await api.get("/admin/audit-logs", {
        params: activeFilters, // filters to backend
      });

      let loadedLogs = res.data.logs;

      // sorting toggle (newest first)
      loadedLogs.sort((a: any, b: any) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return sortNewestFirst ? db - da : da - db;
      });

      setLogs(loadedLogs);
    } catch (err) {
      console.error("Failed to load logs:", err);
    }

    setLoading(false);
  };

  // Load logs when component loads
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const applyFilters = () => {
    setPage(1); // reset pagination when applying new filters
    fetchLogs();
  };

  // added reset filter button with simple state reset
  const resetFilters = () => {
    setFilters({
      action: "",
      userId: "",
      start: "",
      end: "",
    });

    setPage(1);
    fetchLogs();
  };

  // basic pagination logic
  const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(logs.length / pageSize);

  if (loading) return <p className="text-slate-500 p-4">Loading logs...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4 text-[#0f2744]">Audit Log Viewer</h2>

      {/* Filter section */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* dropdown for event action, more user friendly than text */}
        <select
          name="action"
          className="border border-slate-200 p-2 rounded-lg text-sm text-slate-600"
          onChange={handleFilterChange}
          value={filters.action}
        >
          <option value="">Filter by action</option>
          <option value="LOGIN_SUCCESS">Login Success</option>
          <option value="LOGIN_FAILED">Login Failed</option>
          <option value="LOGIN_ERROR">Login Error</option>
          <option value="LOGOUT">Logout</option>
          <option value="USER_REGISTERED">User Registered</option>
          <option value="TOKEN_REFRESHED">Token Refreshed</option>
          <option value="TOKEN_REFRESH_FAILED">Token Refresh Failed</option>
          <option value="TOKEN_REPLAY_ATTEMPT">Token Replay Attempt</option>
          <option value="MFA_ENABLED">MFA Enabled</option>
          <option value="MFA_DISABLED">MFA Disabled</option>
          <option value="MFA_FAILED">MFA Failed</option>
          <option value="MFA_VERIFIED">MFA Verified</option>
          <option value="FILE_UPLOAD">File Upload</option>
          <option value="FILE_DOWNLOAD">File Download</option>
          <option value="FILE_DELETE">File Delete</option>
          <option value="FILE_VIEW">File View</option>
          <option value="FILE_SCAN_FAILED">File Scan Failed</option>
          <option value="UPLOAD_ERROR">Upload Error</option>
          <option value="VIRUS_DETECTED">Virus Detected</option>
          <option value="INPUT_SANITISATION_FAILURE">Input Sanitisation Failure</option>
          <option value="LOG_SYMPTOM">Log Symptom</option>
          <option value="LOG_FOOD">Log Food</option>
          <option value="LOG_MEDICATION">Log Medication</option>
          <option value="DELETE_SYMPTOM_LOG">Delete Symptom Log</option>
          <option value="DELETE_FOOD_LOG">Delete Food Log</option>
          <option value="DELETE_MEDICATION_LOG">Delete Medication Log</option>
          <option value="PATIENT_PROFILE_CREATE">Patient Profile Create</option>
          <option value="PATIENT_PROFILE_UPDATE">Patient Profile Update</option>
          <option value="PATIENT_PROFILE_VIEW">Patient Profile View</option>
          <option value="PATIENT_INSIGHTS_VIEW">Patient Insights View</option>
          <option value="FAVOURITE_ADD">Favourite Add</option>
          <option value="FAVOURITE_DELETE">Favourite Delete</option>
          <option value="FAVOURITE_LIST">Favourite List</option>
          <option value="FREQUENT_ITEMS_VIEW">Frequent Items View</option>
          <option value="AI_CORRELATION_REQUEST">AI Correlation Request</option>
          <option value="AI_INFERENCE_REQUEST">AI Inference Request</option>
          <option value="CLINICIAN_AI_VIEW">Clinician AI View</option>
          <option value="DOCTOR_ACCESS_REQUEST">Doctor Access Request</option>
          <option value="DOCTOR_ACCESS_ACCEPT">Doctor Access Accept</option>
          <option value="DOCTOR_ACCESS_REJECT">Doctor Access Reject</option>
          <option value="DOCTOR_ACCESS_REVOKE">Doctor Access Revoke</option>
          <option value="DOCTOR_ACCESS_LIST">Doctor Access List</option>
          <option value="DOCTOR_ACCESS_REQUEST_LIST">Doctor Access Request List</option>
          <option value="DOCTOR_PATIENT_HISTORY_VIEW">Doctor Patient History View</option>
          <option value="DOCTOR_PATIENT_NOTE_CREATE">Doctor Patient Note Create</option>
          <option value="DOCTOR_PATIENT_NOTE_DELETE">Doctor Patient Note Delete</option>
          <option value="DOCTOR_REQUEST_SUBMITTED">Doctor Request Submitted</option>
          <option value="DOCTOR_REQUEST_APPROVE">Doctor Request Approve</option>
          <option value="DOCTOR_REQUEST_REJECT">Doctor Request Reject</option>
          <option value="DOCTOR_REQUEST_DUPLICATE">Doctor Request Duplicate</option>
          <option value="DOCTOR_REQUEST_LIST_VIEW">Doctor Request List View</option>
          <option value="DOCTOR_REQUEST_VIEW">Doctor Request View</option>
          <option value="DOCTOR_ACCOUNT_ACTIVATED">Doctor Account Activated</option>
          <option value="DOCTOR_ACCOUNT_CREATED">Doctor Account Created</option>
          <option value="DOCTOR_INVITE_CREATED">Doctor Invite Created</option>
          <option value="ACTIVATION_TOKEN_EXPIRED">Activation Token Expired</option>
          <option value="ADMIN_STATS_VIEW">Admin Stats View</option>
        </select>

        <input
          type="text"
          name="userId"
          placeholder="Filter by user ID"
          className="border border-slate-200 p-2 rounded-lg text-sm"
          onChange={handleFilterChange}
          value={filters.userId}
        />

        <input
          type="date"
          name="start"
          className="border border-slate-200 p-2 rounded-lg text-sm"
          onChange={handleFilterChange}
          value={filters.start}
        />

        <input
          type="date"
          name="end"
          className="border border-slate-200 p-2 rounded-lg text-sm"
          onChange={handleFilterChange}
          value={filters.end}
        />

        {/* Apply Filters */}
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-[#0f2744] text-white rounded-lg hover:bg-[#1e3a5f] text-sm font-medium"
        >
          Apply
        </button>
      </div>

      {/* Sorting toggle and reset */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => {
            setSortNewestFirst(!sortNewestFirst);
            fetchLogs(); // reload sorted
          }}
          className="px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-200"
        >
          Sort: {sortNewestFirst ? "Newest first" : "Oldest first"}
        </button>

        {/* Reset Filters button */}
        <button
          onClick={resetFilters}
          className="px-4 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-200"
        >
          Reset filters
        </button>
      </div>

      {/* Audit table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-50 text-left border border-slate-200">
            <th className="p-2 border border-slate-200 text-sm font-medium text-slate-600">Timestamp</th>
            <th className="p-2 border border-slate-200 text-sm font-medium text-slate-600">User</th>
            <th className="p-2 border border-slate-200 text-sm font-medium text-slate-600">Action</th>
            <th className="p-2 border border-slate-200 text-sm font-medium text-slate-600">IP Address</th>
            <th className="p-2 border border-slate-200 text-sm font-medium text-slate-600">Metadata</th>
          </tr>
        </thead>

        <tbody>
          {paginatedLogs.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-slate-500 text-sm">
                No logs found for these filters.
              </td>
            </tr>
          )}

          {paginatedLogs.map((log) => (
            <tr key={log.id} className="border border-slate-200 hover:bg-slate-50">
              <td className="p-2 border border-slate-200 text-sm text-slate-600">
                {new Date(log.createdAt).toLocaleString()}
              </td>

              <td className="p-2 border border-slate-200 text-sm text-slate-600">
                {log.user
                  ? `${log.user.email} (${log.user.role})`
                  : "N/A"}
              </td>

              <td className="p-2 border border-slate-200">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {log.action}
                </span>
              </td>

              <td className="p-2 border border-slate-200 text-sm text-slate-600">
                {log.ipAddress || "N/A"}
              </td>

              <td className="p-2 border border-slate-200 text-sm text-slate-500">
                {log.details ? JSON.stringify(log.details, null, 2) : "None"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Page navigation */}
      <div className="flex items-center justify-center mt-6 space-x-4">
        <button
          className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-200"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>

        <span className="text-sm font-medium text-slate-600">
          Page {page} / {totalPages}
        </span>

        <button
          className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-200"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default AuditLogViewer;