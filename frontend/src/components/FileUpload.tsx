import React, { useState } from "react";
import { uploadFile } from "../services/Api";

// Secure file upload component uses the backend encryption route

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
    <div className="p-4 max-w-lg mx-auto border rounded shadow bg-white mt-8">
      <h2 className="text-xl font-semibold mb-3">Secure File Upload</h2>

      <input type="file" onChange={handleFileChange} className="mb-4" />

      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Upload File
      </button>

      {status && (
        <p className="mt-3 text-sm text-gray-700">
          {status}
        </p>
      )}
    </div>
  );
}

export default FileUpload;