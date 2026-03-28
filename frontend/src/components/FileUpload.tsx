import React, { useCallback, useEffect, useState } from "react";
import {
  deleteFile,
  downloadFile,
  getCurrentUser,
  getDoctorAssignedPatients,
  listFiles,
  uploadFile,
} from "../services/Api";

// Secure file page uses the backend encryption route (upload, view, export)

type FileRecord = {
  id: number;
  ownerPatientId: number;
  ownerPatientEmail?: string | null;
  uploadedByUserId: number;
  uploaderEmail?: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  createdAt: string;
};

type AssignedPatient = {
  id: number;
  patientId: number;
  patientEmail: string | null;
  status: "ACTIVE";
  updatedAt: string;
};

function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<AssignedPatient[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [role, setRole] = useState<string>("");
  const [ownerPatientId, setOwnerPatientId] = useState<string>("");

  // frontend validation acts as first layer only (backend still enforces validation + scanning)
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg","application/zip",
  "application/x-zip-compressed"];

  const loadAssignedPatients = useCallback(async () => {
    // only doctors should ever fetch assigned patients (RBAC enforced again on backend)
    if (role !== "doctor") {
      setAssignedPatients([]);
      return;
    }

    try {
      const result = await getDoctorAssignedPatients();
      setAssignedPatients(result.assignments || []);
    } catch (err: any) {
      setStatus("Could not load assigned patients right now.");
    }
  }, [role]);

  const loadFiles = useCallback(async () => {
    // admins are intentionally blocked from file access (privacy + least privilege)
    if (role === "admin") {
      setFiles([]);
      setLoadingFiles(false);
      return;
    }

    try {
      setLoadingFiles(true);
      const result = await listFiles();
      setFiles(result.files || []);
    } catch (err: any) {
      setStatus("Could not load files right now.");
    } finally {
      setLoadingFiles(false);
    }
  }, [role]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const me = await getCurrentUser();
        setCurrentUserId(me?.id || null);
        setRole(me?.role || "");
      } catch (err: any) {
        setStatus("Could not load secure file access right now.");
        setLoadingFiles(false);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    // once role is known, load correct data based on permissions
    if (role) {
      loadAssignedPatients();
      loadFiles();
    }
  }, [role, loadAssignedPatients, loadFiles]);

  // Handle file selection from input box
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;

    // basic MIME type check (OWASP - never trust file input)
    if (selected && !allowedTypes.includes(selected.type)) {
      setStatus("Invalid file type. Only PDF, JPG, and PNG allowed.");
      setFile(null);
      return;
    }

    setFile(selected);
    setStatus("");
  };

  // Upload handler (pattern adapted from StackOverflow Axios FormData example)
  // ref: https://stackoverflow.com/questions/47630163/axios-post-request-to-send-form-data
  const handleUpload = async () => {
    if (!file) {
      setStatus("Please select a valid file before uploading.");
      return;
    }

    // doctors must choose which patient the file belongs to
    if (role === "doctor" && !ownerPatientId.trim()) {
      setStatus("Select an assigned patient before uploading.");
      return;
    }

    // frontend guard (backend also enforces this)
    if (role === "admin") {
      setStatus("Admin accounts cannot access patient files.");
      return;
    }

    try {
      setStatus("Uploading...");

      const result = await uploadFile(
        file,
        role === "doctor" ? parseInt(ownerPatientId, 10) : undefined // convert to number for API
      );
      setFile(null);
      await loadFiles();

      setStatus(result.message || "File uploaded successfully.");
    } catch (err: any) {
      // error message no sensitive info
      setStatus("Upload failed. Please try again.");
    }
  };

  const handleDownload = async (fileRecord: FileRecord) => {
    try {
      const blob = await downloadFile(fileRecord.id);

      // create temporary URL to trigger browser download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileRecord.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setStatus("File download started.");
    } catch (err: any) {
      setStatus("Download failed. Please try again.");
    }
  };

  const handleDelete = async (fileId: number) => {
    try {
      setStatus("Deleting file...");
      await deleteFile(fileId);
      await loadFiles();
      setStatus("File deleted successfully.");
    } catch (err: any) {
      setStatus("Delete failed. Please try again.");
    }
  };

  // split files into my upload and shared
  const myUploadedFiles = currentUserId
    ? files.filter((fileRecord) => fileRecord.uploadedByUserId === currentUserId)
    : [];

  const sharedFiles = currentUserId
    ? files.filter((fileRecord) => fileRecord.uploadedByUserId !== currentUserId)
    : [];

  // doctors filter by selected patient to avoid mixing patient data
  const selectedPatientFiles = role === "doctor" && ownerPatientId
    ? sharedFiles.filter((fileRecord) => fileRecord.ownerPatientId === parseInt(ownerPatientId, 10))
    : sharedFiles;

  const renderFilesTable = (tableFiles: FileRecord[], showPatientColumn: boolean = false) => (
    tableFiles.length === 0 ? (
      <p className="text-sm text-slate-600">No files in this section yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full border rounded text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">Size</th>
              <th className="p-3 text-left">Uploaded By</th>
              {showPatientColumn && <th className="p-3 text-left">For Patient</th>}
              <th className="p-3 text-left">Stored</th>
              <th className="p-3 text-left">Uploaded</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableFiles.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="p-3">{item.originalName}</td>
                <td className="p-3">{item.mimeType}</td>
                <td className="p-3">{item.sizeBytes} bytes</td>
                <td className="p-3">{item.uploaderEmail || "Unknown uploader"}</td>
                {showPatientColumn && (
                  <td className="p-3">{item.ownerPatientEmail || `Patient #${item.ownerPatientId}`}</td>
                )}
                <td className="p-3">{item.storageProvider}</td>
                <td className="p-3">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="p-3 space-x-2">
                  <button
                    onClick={() => handleDownload(item)}
                    className="bg-slate-900 text-white px-3 py-1 rounded hover:bg-slate-800"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">

      <h1 className="text-3xl font-bold mb-4">Secure Files</h1>

      <p className="text-slate-700 mb-8">
        Upload, view, download, and delete medical files securely. All files are scanned,
        encrypted, and audit logged by the system.
      </p>

      {/* ------------- UPLOAD SECTION ------------------- */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-lg font-semibold mb-2">Upload File</h2>
        <p className="text-sm text-slate-600 mb-4">
          Supported formats: PDF, JPG, PNG. Files are scanned and encrypted before storage.
        </p>

        {role === "doctor" && (
          <select
            value={ownerPatientId}
            onChange={(e) => setOwnerPatientId(e.target.value)}
            className="mb-4 block border rounded px-3 py-2 w-full max-w-xs"
          >
            <option value="">Select assigned patient</option>
            {assignedPatients.map((patient) => (
              <option key={patient.id} value={patient.patientId}>
                {patient.patientEmail || `Patient #${patient.patientId}`}
              </option>
            ))}
          </select>
        )}

        <input
          type="file"
          onChange={handleFileChange}
          className="mb-4 block"
        />

        <button
          onClick={handleUpload}
          disabled={role === "admin"}
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
        >
          Upload File
        </button>

        {status && (
          <p className="mt-3 text-sm text-slate-700">
            {status}
          </p>
        )}
      </div>

      {/* -------- VIEW FILES SECTION ---------------------- */}
      {/* metadata only shown here, actual file content stays encrypted server-side */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-lg font-semibold mb-2">Secure File Metadata</h2>
        <p className="text-sm text-slate-600 mb-4">
          Metadata only. File contents stay encrypted on the backend until download.
        </p>

        {role === "admin" ? (
          <p className="text-sm text-slate-600">
            Admin accounts do not have access to patient file browsing, downloads, or deletes.
          </p>
        ) : loadingFiles ? (
          <p className="text-sm text-slate-600">Loading files...</p>
        ) : (
          <div className="space-y-8">
            <div>
              <h3 className="text-md font-semibold mb-3">
                {role === "doctor" ? "Assigned patient files" : "Files shared with you by your doctor"}
              </h3>
              {role === "doctor" && !ownerPatientId ? (
                <p className="text-sm text-slate-600">Select an assigned patient to view shared files.</p>
              ) : (
                renderFilesTable(selectedPatientFiles)
              )}
            </div>

            <div>
              <h3 className="text-md font-semibold mb-3">Your uploaded files</h3>
              {renderFilesTable(myUploadedFiles, role === "doctor")}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default FileUpload;