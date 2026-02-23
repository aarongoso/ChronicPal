import React, { useState } from "react";
import api from "../services/Api";

const DoctorActivation: React.FC = () => {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isStrongPassword = (value: string) => {
    if (value.length < 12) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[0-9]/.test(value)) return false;
    if (!/[^A-Za-z0-9]/.test(value)) return false;
    return true;
  };

  const validate = () => {
    // Token length is checked server side
    if (token.trim().length < 20) {
      return "Activation token is required.";
    }

    // Keep rules aligned with validateActivation middleware on backend
    if (!isStrongPassword(password)) {
      return "Password must be 12+ chars and include upper, lower, digit, and symbol.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    // backend still validates token + password policy
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      // Activation endpoint swaps the placeholder password for the real password
      // Token is stored hashed server-side (SHA-256) so raw token never persisted
      await api.post("/doctor-activation", {
        token: token.trim(),
        password,
        confirmPassword,
      });

      setMessage("Doctor account activated. You can now login.");
      setToken("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      const backendError = err?.response?.data?.error;
      setError(backendError || "Activation failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 w-full max-w-md shadow-lg rounded-xl"
      >
        <h2 className="text-2xl font-bold text-center mb-4">
          Doctor Account Activation
        </h2>
        <p className="text-xs text-gray-500 mb-3 text-center">
          Enter the activation token provided by the admin, then set a strong
          password to activate your account.
        </p>

        <input
          type="text"
          placeholder="Activation Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          required
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-2 border rounded mb-3"
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 w-full text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Activating..." : "Activate Account"}
        </button>

        {error && <p className="text-center mt-4 text-sm text-red-600">{error}</p>}
        {message && <p className="text-center mt-4 text-sm text-gray-700">{message}</p>}
      </form>
    </div>
  );
};

export default DoctorActivation;