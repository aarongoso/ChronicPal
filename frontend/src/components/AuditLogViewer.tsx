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

  // simple colour badges for actions
  const actionColours: any = {
    LOGIN_SUCCESS: "bg-green-600 text-white",
    LOGIN_FAILED: "bg-red-600 text-white",
    FILE_UPLOAD: "bg-blue-600 text-white",
    VIRUS_DETECTED: "bg-yellow-600 text-black",
    ACCOUNT_REGISTERED: "bg-purple-600 text-white",
    UPLOAD_ERROR: "bg-orange-600 text-white",
  };

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

  if (loading) return <p>Loading logs...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Audit Log Viewer</h2>

      {/* Filter section */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {/* dropdown for event action, more user friendly than text*/}
        <select
          name="action"
          className="border p-2 rounded"
          onChange={handleFilterChange}
          value={filters.action}
        >
          <option value="">Filter by action</option>
          <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
          <option value="LOGIN_FAILED">LOGIN_FAILED</option>
          <option value="FILE_UPLOAD">FILE_UPLOAD</option>
          <option value="VIRUS_DETECTED">VIRUS_DETECTED</option>
          <option value="ACCOUNT_REGISTERED">ACCOUNT_REGISTERED</option>
          <option value="UPLOAD_ERROR">UPLOAD_ERROR</option>
        </select>

        <input
          type="text"
          name="userId"
          placeholder="Filter by user ID"
          className="border p-2 rounded"
          onChange={handleFilterChange}
          value={filters.userId}
        />

        <input
          type="date"
          name="start"
          className="border p-2 rounded"
          onChange={handleFilterChange}
          value={filters.start}
        />

        <input
          type="date"
          name="end"
          className="border p-2 rounded"
          onChange={handleFilterChange}
          value={filters.end}
        />

        {/* Apply Filters */}
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      {/* Sorting toggle */}
      <button
        onClick={() => {
          setSortNewestFirst(!sortNewestFirst);
          fetchLogs(); // reload sorted
        }}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 mr-4"
      >
        Sort by Date: {sortNewestFirst ? "Newest First" : "Oldest First"}
      </button>

      {/* Reset Filters button */}
      <button
        onClick={resetFilters}
        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 mb-6"
      >
        Reset Filters
      </button>

      {/* Audit table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="p-2 border">Timestamp</th>
            <th className="p-2 border">User</th>
            <th className="p-2 border">Action</th>
            <th className="p-2 border">IP Address</th>
            <th className="p-2 border">Metadata</th>
          </tr>
        </thead>

        <tbody>
          {paginatedLogs.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-600">
                No logs found for these filters.
              </td>
            </tr>
          )}

          {paginatedLogs.map((log) => (
            <tr key={log.id} className="border">
              <td className="p-2 border">
                {new Date(log.createdAt).toLocaleString()}
              </td>

              <td className="p-2 border">
                {log.user
                  ? `${log.user.email} (${log.user.role})`
                  : "N/A"}
              </td>

              <td className="p-2 border">
                {/* coloured badge for action */}
                <span
                  className={`px-2 py-1 rounded text-sm font-semibold ${
                    actionColours[log.action] || "bg-gray-500 text-white"
                  }`}
                >
                  {log.action}
                </span>
              </td>

              <td className="p-2 border">{log.ipAddress || "N/A"}</td>

              <td className="p-2 border">
                {log.details ? JSON.stringify(log.details, null, 2) : "None"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Page navigation */}
      <div className="flex items-center justify-center mt-6 space-x-4">
        <button
          className="px-3 py-1 bg-gray-400 text-white rounded disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>

        <span className="text-lg font-semibold">
          Page {page} / {totalPages}
        </span>

        <button
          className="px-3 py-1 bg-gray-400 text-white rounded disabled:opacity-40"
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