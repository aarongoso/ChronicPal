import React, { useState } from "react";
import { uploadFile } from "../services/Api";

// Secure file page uses the backend encryption route (upload, view, export)

function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

  // Frontend validation to prevent obviously invalid files
  const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];

  // Handle file selection from input box
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;

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

    try {
      setStatus("Uploading...");

      const result = await uploadFile(file);

      setStatus(result.message || "File uploaded successfully.");
    } catch (err: any) {
      // error message no sensitive info
      setStatus("Upload failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">

      <h1 className="text-3xl font-bold mb-4">Secure Files</h1>

      <p className="text-slate-700 mb-8">
        Upload, view, and export medical files securely. All files are scanned,
        encrypted, and audit logged by the system.
      </p>

      {/* ------------- UPLOAD SECTION ------------------- */}
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-lg font-semibold mb-2">Upload File</h2>
        <p className="text-sm text-slate-600 mb-4">
          Supported formats: PDF, JPG, PNG. Files are scanned and encrypted before storage.
        </p>

        <input
          type="file"
          onChange={handleFileChange}
          className="mb-4 block"
        />

        <button
          onClick={handleUpload}
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
      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <h2 className="text-lg font-semibold mb-2">Your Files</h2>
        <p className="text-sm text-slate-600 mb-4">
          Placeholder view. Uploaded files will appear here with metadata only
          (filename, type, date).
        </p>

        {/* Placeholder table for midpoint demo */}
        <div className="border rounded text-sm">
          <div className="p-3 border-b font-medium">example-report.pdf</div>
          <div className="p-3 border-b font-medium">scan-image.png</div>
          <div className="p-3 font-medium">lab-results.jpg</div>
        </div>
      </div>

      {/* ---------------------- EXPORT SECTION ----------------- */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-2">Export Records</h2>
        <p className="text-sm text-slate-600 mb-4">
          Export your files and records in a secure format. All exports are audit logged.
        </p>

        <button
          className="bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-800 text-sm"
          // TODO: implement secure export endpoint after midpoint
          onClick={() =>
            alert("Export functionality will be added after midpoint review.")
          }
        >
          Export Records
        </button>
      </div>

    </div>
  );
}

export default FileUpload;