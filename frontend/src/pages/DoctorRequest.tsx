import React, { useState } from "react";
import api from "../services/Api";

const DoctorRequest: React.FC = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [clinicOrHospital, setClinicOrHospital] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // backend does the real sanitisation + validation
  const isValidEmail = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  };

  const isValidLicense = (value: string) => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) return false;
    if (normalized.length < 3 || normalized.length > 40) return false;
    return /^[A-Z0-9-]+$/.test(normalized);
  };

  const validate = () => {
    const name = fullName.trim();
    const mail = email.trim();
    const clinic = clinicOrHospital.trim();
    const license = licenseNumber.trim();

    if (name.length < 2 || name.length > 120) {
      return "Full name must be between 2 and 120 characters.";
    }
    if (!isValidEmail(mail) || mail.length > 100) {
      return "Please enter a valid email address.";
    }
    if (clinic.length < 2 || clinic.length > 160) {
      return "Clinic/Hospital must be between 2 and 160 characters.";
    }
    if (!isValidLicense(license)) {
      return "License number must be 3-40 characters and use A-Z, 0-9, or hyphens.";
    }
    if (notes.trim().length > 500) {
      return "Notes must be 500 characters or less.";
    }
    return "";
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setClinicOrHospital("");
    setLicenseNumber("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      await api.post("/public/doctor-requests", {
        fullName: fullName.trim(),
        email: email.trim(),
        clinicOrHospital: clinicOrHospital.trim(),
        licenseNumber: licenseNumber.trim().toUpperCase(),
        notes: notes.trim() ? notes.trim() : undefined,
      });
    } catch {
      // Intentionally ignored to avoid revealing whether duplicates/validation occurred
    } finally {
      setSubmitting(false);
      setMessage("Request received");
      resetForm();
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 w-full max-w-md shadow-lg rounded-xl"
      >
        <h2 className="text-2xl font-bold text-center mb-4">
          Doctor Account Request
        </h2>
        <p className="text-xs text-gray-500 mb-3 text-center">
          Requests are reviewed by an admin. If approved, you will receive an activation token from the admin (no email).
        </p>

        <input
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          maxLength={120}
          required
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          maxLength={100}
          required
        />

        <input
          type="text"
          placeholder="Clinic or Hospital"
          value={clinicOrHospital}
          onChange={(e) => setClinicOrHospital(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          maxLength={160}
          required
        />

        <input
          type="text"
          placeholder="License Number"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          maxLength={40}
          required
        />

        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full p-2 border rounded mb-3 h-24"
          maxLength={500}
        />

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 w-full text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>

        {error && (
          <p className="text-center mt-4 text-sm text-red-600">{error}</p>
        )}
        {message && (
          <p className="text-center mt-4 text-sm text-gray-700">{message}</p>
        )}
      </form>
    </div>
  );
};

export default DoctorRequest;