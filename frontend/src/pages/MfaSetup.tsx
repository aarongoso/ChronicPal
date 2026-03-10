import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/Api";

function MfaSetup() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const authToken = useMemo(() => {
    return localStorage.getItem("accessToken") || localStorage.getItem("mfaSetupToken") || "";
  }, []);

  useEffect(() => {
    const initiate = async () => {
      if (!authToken) {
        navigate("/login");
        return;
      }

      try {
        const res = await api.post(
          "/auth/mfa/setup/initiate",
          {},
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        setSecret(res.data.base32Secret || "");
        setQrDataUrl(res.data.qrCodeDataUrl || "");
      } catch (err: any) {
        setMessage(err?.error || "Unable to start MFA setup.");
      } finally {
        setLoading(false);
      }
    };

    initiate();
  }, [authToken, navigate]);

  const verifySetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (!authToken) {
      navigate("/login");
      return;
    }

    try {
      await api.post(
        "/auth/mfa/setup/verify",
        { code: code.trim() },
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      localStorage.removeItem("mfaSetupToken");
      setDone(true);
      setMessage("MFA setup completed. Please log in again.");
    } catch (err: any) {
      setMessage(err?.error || "Invalid code. Please try again.");
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading MFA setup...</div>;
  }

  return (
    <div className="max-w-lg mx-auto mt-10 p-6 bg-white rounded-xl shadow">
      <h1 className="text-2xl font-bold mb-4">Set Up MFA</h1>
      <p className="text-sm text-gray-700 mb-4">
        Scan this QR with Google Authenticator, Authy, or Microsoft Authenticator.
      </p>

      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="MFA QR"
          className="w-56 h-56 mx-auto border rounded mb-4"
        />
      )}

      <p className="text-sm text-gray-700 mb-1">Manual setup key:</p>
      <code className="block text-xs bg-gray-100 p-2 rounded mb-4 break-all">{secret}</code>

      {!done && (
        <form onSubmit={verifySetup}>
          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border rounded p-2 mb-3"
          />
          <button className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            Verify and Enable MFA
          </button>
        </form>
      )}

      {done && (
        <button
          onClick={() => navigate("/login")}
          className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700"
        >
          Go to Login
        </button>
      )}

      <p className="text-xs text-gray-600 mt-4">
        Recovery: if you lose access to your authenticator app, contact admin/support.
      </p>

      {message && <p className="text-sm mt-3 text-gray-800">{message}</p>}
    </div>
  );
}

export default MfaSetup;