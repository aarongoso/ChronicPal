import React, { useEffect, useState } from "react";
import api from "../services/Api";

// can view audit logs, filter logs and see security critical events
function AuditLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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

      setLogs(res.data.logs);
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

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value,
    });
  };

  const applyFilters = () => {
    fetchLogs();
  };

  if (loading) return <p>Loading logs...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Audit Log Viewer</h2>

      {/* Filter section */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <input
          type="text"
          name="action"
          placeholder="Filter by action"
          className="border p-2 rounded"
          onChange={handleFilterChange}
        />

        <input
          type="text"
          name="userId"
          placeholder="Filter by user ID"
          className="border p-2 rounded"
          onChange={handleFilterChange}
        />

        <input
          type="date"
          name="start"
          className="border p-2 rounded"
          onChange={handleFilterChange}
        />

        <input
          type="date"
          name="end"
          className="border p-2 rounded"
          onChange={handleFilterChange}
        />
      </div>

      <button
        onClick={applyFilters}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-6"
      >
        Apply Filters
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
          {logs.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-600">
                No logs found for these filters.
              </td>
            </tr>
          )}

          {logs.map((log) => (
            <tr key={log.id} className="border">
              <td className="p-2 border">
                {new Date(log.createdAt).toLocaleString()}
              </td>

              <td className="p-2 border">
                {log.user
                  ? `${log.user.email} (${log.user.role})`
                  : "N/A"}
              </td>

              <td className="p-2 border">{log.action}</td>

              <td className="p-2 border">{log.ipAddress || "N/A"}</td>

              <td className="p-2 border">
                {log.details ? JSON.stringify(log.details, null, 2) : "None"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AuditLogViewer;