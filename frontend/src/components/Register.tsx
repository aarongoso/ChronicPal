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
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 w-96 border border-slate-200 rounded-2xl"
      >

        <h2 className="text-2xl font-bold text-center mb-1 text-[#0f2744]">
          Create an account
        </h2>

        <p className="text-sm text-slate-500 text-center mb-6">
          Register as a patient to start managing your health
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(sanitize(e.target.value))}
          className="w-full p-2 border border-slate-200 rounded-lg mb-3 text-sm"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(sanitize(e.target.value))}
          className="w-full p-2 border border-slate-200 rounded-lg mb-3 text-sm"
          required
        />

        {/* Removed dropdown: only patients can self register */}
        <p className="text-slate-500 text-sm mb-3">
          Account type: <strong className="text-[#0f2744]">Patient</strong>
        </p>

        <button className="bg-[#0f2744] w-full text-white p-2 rounded-lg hover:bg-[#1e3a5f] text-sm font-medium">
          Register
        </button>

        {message && (
          <p className="text-center mt-4 text-sm text-slate-600">{message}</p>
        )}

        {/* doctor onboarding: request based*/}
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 mb-1">
            Are you a doctor?
          </p>
          <p className="text-xs text-slate-400 mb-2">
            After admin approval you'll receive an activation token from the admin
          </p>
          <Link
            to="/doctor-request"
            className="text-sm text-sky-500 hover:text-sky-400"
          >
            Request a doctor account
          </Link>
          <div className="mt-2">
            <Link
              to="/doctor-activation"
              className="text-sm text-sky-500 hover:text-sky-400"
            >
              Activate doctor account
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

export default Register;
