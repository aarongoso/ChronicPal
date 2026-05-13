import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/Api";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [message, setMessage] = useState("");
  const [isMfaStep, setIsMfaStep] = useState(false);

  const sanitize = (value: string) => value.replace(/[<>]/g, "");

  const redirectByRole = (role?: string) => {
    if (role === "admin") {
      window.location.href = "/admin";
    } else if (role === "doctor") {
      window.location.href = "/doctor";
    } else {
      window.location.href = "/patient";
    }
  };

  const handlePasswordStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await api.post("/auth/login", {
        email: sanitize(email),
        password: sanitize(password),
      });

      if (res.data?.mfaSetupRequired && res.data?.setupToken) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("role");
        localStorage.setItem("mfaSetupToken", res.data.setupToken);
        navigate("/mfa/setup");
        return;
      }

      if (res.data?.mfaRequired && res.data?.challengeToken) {
        setChallengeToken(res.data.challengeToken);
        setIsMfaStep(true);
        setMessage("Enter your authenticator app code to continue.");
        return;
      }

      if (res.data?.token) {
        localStorage.removeItem("mfaSetupToken");
        localStorage.setItem("accessToken", res.data.token);
        if (res.data.user?.role) {
          localStorage.setItem("role", res.data.user.role);
        }
        redirectByRole(res.data.user?.role);
      }
    } catch (err: any) {
      setMessage(err?.error || "Invalid login. Please try again.");
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    try {
      const res = await api.post("/auth/mfa/verify", {
        challengeToken,
        code: sanitize(mfaCode).trim(),
      });

      localStorage.removeItem("mfaSetupToken");
      localStorage.setItem("accessToken", res.data.token);
      if (res.data.user?.role) {
        localStorage.setItem("role", res.data.user.role);
      }
      redirectByRole(res.data.user?.role);
    } catch (err: any) {
      setMessage(err?.error || "Invalid verification code.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <form
        onSubmit={isMfaStep ? handleMfaVerify : handlePasswordStep}
        className="bg-white p-8 w-96 border border-slate-200 rounded-2xl"
      >
        <h2 className="text-2xl font-bold text-center mb-1 text-[#0f2744]">
          {isMfaStep ? "Two-factor verification" : "Welcome back"}
        </h2>

        {!isMfaStep && (
          <p className="text-sm text-slate-500 text-center mb-6">
            Log in to access your health logs, insights, and secure medical records.
          </p>
        )}

        {isMfaStep && (
          <p className="text-sm text-slate-500 text-center mb-6">
            Enter the code from your authenticator app to continue.
          </p>
        )}

        {!isMfaStep && (
          <>
            <input
              type="email"
              placeholder="Email"
              onChange={(e) => setEmail(sanitize(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded-lg mb-3 text-sm"
            />

            <input
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(sanitize(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded-lg mb-3 text-sm"
            />
          </>
        )}

        {isMfaStep && (
          <>
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              onChange={(e) => setMfaCode(sanitize(e.target.value))}
              className="w-full p-2 border border-slate-200 rounded-lg mb-3 text-sm"
            />
            <p className="text-xs text-slate-500 mb-3">
              If you cannot access your authenticator app, contact admin/support.
            </p>
          </>
        )}

        <button className="bg-[#0f2744] w-full text-white p-2 rounded-lg hover:bg-[#1e3a5f]">
          {isMfaStep ? "Verify code" : "Log in"}
        </button>

        {message && (
          <p className="text-center mt-4 text-sm text-slate-600">{message}</p>
        )}
      </form>
    </div>
  );
}

export default Login;