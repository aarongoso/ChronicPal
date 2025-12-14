import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/Api";

function Register() {
  // Track form inputs securely in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  // Sanitise input (prevent XSS data submission)
  const sanitize = (value: string) =>
    value.replace(/[<>]/g, ""); // Removes any HTML tags or scripts

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/register", {
        email: sanitize(email),
        password: sanitize(password),
        role: "patient", // enforce backend rule (only patients self register)
      });

      setMessage(res.data.message || "Registration completed.");
    } catch {
      setMessage("Registration failed. Please try again.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 w-80 shadow-lg rounded-xl"
      >
        <h2 className="text-2xl font-bold text-center mb-4">Register</h2>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(sanitize(e.target.value))}
          className="w-full p-2 border rounded mb-3"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(sanitize(e.target.value))}
          className="w-full p-2 border rounded mb-3"
          required
        />

        {/* Removed dropdown: only patients can self register */}
        <p className="text-gray-600 text-sm mb-3">
          Account type: <strong>Patient</strong>
        </p>

        <button className="bg-blue-600 w-full text-white p-2 rounded-lg hover:bg-blue-700">
          Register
        </button>

        {message && (
          <p className="text-center mt-4 text-sm text-gray-700">{message}</p>
        )}

        {/* doctor onboarding: request based*/}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500 mb-1">
            Are you a doctor?
          </p>
          <Link
            to="/doctor-request"
            className="text-sm text-blue-600 hover:underline"
          >
            Request a Doctor Account
          </Link>
        </div>
      </form>
    </div>
  );
}

export default Register;
