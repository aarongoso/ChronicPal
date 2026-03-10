import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disableMfa, getCurrentUser } from "../services/Api";

type CurrentUser = {
  id: number;
  email: string;
  role: string;
  mfaEnabled: boolean;
};
//TODO: add more detail near end of project
function PatientProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const data = await getCurrentUser();
        if (!mounted) return;

        // The route is protected, but this page is patient specific
        // so enforce boundary in the UI as well
        if (data.role !== "patient") {
          navigate("/", { replace: true });
          return;
        }

        setUser(data);
      } catch (err: any) {
        if (!mounted) return;
        setMessage(err?.error || "Unable to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const refreshUser = async () => {
    const data = await getCurrentUser();
    setUser(data);
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!code.trim() || !password.trim()) {
      setMessage("Code and current password are required.");
      return;
    }

    try {
      const payload: { code: string; password?: string } = {
        code: code.trim(),
        password,
      };

      const res = await disableMfa(payload);
      await refreshUser();
      setCode("");
      setPassword("");
      setMessage(res.message || "MFA disabled successfully.");
    } catch (err: any) {
      setMessage(err?.error || "Unable to update MFA settings.");
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-100 p-8">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white p-6 rounded-xl shadow mb-6">
          <h1 className="text-2xl font-bold">Manage Profile</h1>
          <p className="text-sm text-slate-600 mt-1">
            Review your account details and manage optional security settings.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Account Security / MFA</h2>
          <p className="text-sm text-slate-600 mt-1">
            Status:{" "}
            <span className={user?.mfaEnabled ? "text-emerald-700 font-medium" : "text-slate-700 font-medium"}>
              {user?.mfaEnabled ? "Enabled" : "Disabled"}
            </span>
          </p>

          {!user?.mfaEnabled ? (
            <div className="mt-5">
              <p className="text-sm text-slate-600 mb-4">
                Add an authenticator app to strengthen access to your account.
              </p>
              <button
                onClick={() => navigate("/mfa/setup")}
                className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
              >
                Enable MFA
              </button>
            </div>
          ) : (
            <form onSubmit={handleDisableMfa} className="mt-5 space-y-4">
              <p className="text-sm text-slate-600">
                To disable MFA, confirm both your current authenticator code and password.
              </p>

              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full border rounded p-2"
              />

              <input
                type="password"
                placeholder="Current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded p-2"
              />

              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Disable MFA
              </button>
            </form>
          )}

          <p className="text-xs text-slate-500 mt-4">
            If you lose access to your authenticator app, contact support.
          </p>

          {message ? <p className="text-sm text-slate-700 mt-4">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default PatientProfile;