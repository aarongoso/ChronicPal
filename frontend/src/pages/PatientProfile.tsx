import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { disableMfa, getCurrentUser, getPatientProfile, updatePatientProfile } from "../services/Api";

type CurrentUser = {
  id: number;
  email: string;
  role: string;
  mfaEnabled: boolean;
};

type HealthProfileForm = {
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  bloodType: string;
  gender: string;
  chronicConditions: string;
  allergies: string;
  medicalHistorySummary: string;
};

const emptyHealthProfile: HealthProfileForm = {
  dateOfBirth: "",
  heightCm: "",
  weightKg: "",
  bloodType: "",
  gender: "",
  chronicConditions: "",
  allergies: "",
  medicalHistorySummary: "",
};

function PatientProfile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [healthProfile, setHealthProfile] = useState<HealthProfileForm>(emptyHealthProfile);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
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

        const profileData = await getPatientProfile();
        if (!mounted) return;

        const profile = profileData?.profile;
        if (profile) {
          setHealthProfile({
            dateOfBirth: profile.dateOfBirth || "",
            heightCm: profile.heightCm === null || profile.heightCm === undefined ? "" : String(profile.heightCm),
            weightKg: profile.weightKg === null || profile.weightKg === undefined ? "" : String(profile.weightKg),
            bloodType: profile.bloodType || "",
            gender: profile.gender || "",
            chronicConditions: profile.chronicConditions || "",
            allergies: profile.allergies || "",
            medicalHistorySummary: profile.medicalHistorySummary || "",
          });
        }
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

  const handleHealthProfileChange = (field: keyof HealthProfileForm, value: string) => {
    setHealthProfile((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveHealthProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage("");

    try {
      setSavingProfile(true);
      const result = await updatePatientProfile({
        dateOfBirth: healthProfile.dateOfBirth || null,
        heightCm: healthProfile.heightCm || null,
        weightKg: healthProfile.weightKg || null,
        bloodType: healthProfile.bloodType || null,
        gender: healthProfile.gender || null,
        chronicConditions: healthProfile.chronicConditions || null,
        allergies: healthProfile.allergies || null,
        medicalHistorySummary: healthProfile.medicalHistorySummary || null,
      });

      const profile = result?.profile;
      if (profile) {
        setHealthProfile({
          dateOfBirth: profile.dateOfBirth || "",
          heightCm: profile.heightCm === null || profile.heightCm === undefined ? "" : String(profile.heightCm),
          weightKg: profile.weightKg === null || profile.weightKg === undefined ? "" : String(profile.weightKg),
          bloodType: profile.bloodType || "",
          gender: profile.gender || "",
          chronicConditions: profile.chronicConditions || "",
          allergies: profile.allergies || "",
          medicalHistorySummary: profile.medicalHistorySummary || "",
        });
      }

      setProfileMessage("Health profile saved.");
    } catch (err: any) {
      setProfileMessage(err?.error || "Unable to save health profile.");
    } finally {
      setSavingProfile(false);
    }
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

        <div className="bg-white p-6 rounded-xl shadow mb-6">
          <h2 className="text-lg font-semibold">Health Profile</h2>
          <form onSubmit={handleSaveHealthProfile} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-sm text-slate-700">
                Date of birth
                <input
                  type="date"
                  value={healthProfile.dateOfBirth}
                  onChange={(e) => handleHealthProfileChange("dateOfBirth", e.target.value)}
                  className="mt-1 w-full border rounded p-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Height (cm)
                <input
                  type="number"
                  min="30"
                  max="250"
                  step="0.01"
                  value={healthProfile.heightCm}
                  onChange={(e) => handleHealthProfileChange("heightCm", e.target.value)}
                  className="mt-1 w-full border rounded p-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                Weight (kg)
                <input
                  type="number"
                  min="1"
                  max="400"
                  step="0.01"
                  value={healthProfile.weightKg}
                  onChange={(e) => handleHealthProfileChange("weightKg", e.target.value)}
                  className="mt-1 w-full border rounded p-2"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm text-slate-700">
                Blood type
                <select
                  value={healthProfile.bloodType}
                  onChange={(e) => handleHealthProfileChange("bloodType", e.target.value)}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="">Not provided</option>
                  <option value="A_POS">A+</option>
                  <option value="A_NEG">A-</option>
                  <option value="B_POS">B+</option>
                  <option value="B_NEG">B-</option>
                  <option value="O_POS">O+</option>
                  <option value="O_NEG">O-</option>
                  <option value="AB_POS">AB+</option>
                  <option value="AB_NEG">AB-</option>
                </select>
              </label>

              <label className="text-sm text-slate-700">
                Biological sex
                <select
                  value={healthProfile.gender}
                  onChange={(e) => handleHealthProfileChange("gender", e.target.value)}
                  className="mt-1 w-full border rounded p-2"
                >
                  <option value="">Not provided</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              Chronic conditions
              <textarea
                value={healthProfile.chronicConditions}
                onChange={(e) => handleHealthProfileChange("chronicConditions", e.target.value)}
                maxLength={1000}
                className="mt-1 w-full border rounded p-2 min-h-24"
              />
            </label>

            <label className="block text-sm text-slate-700">
              Allergies
              <textarea
                value={healthProfile.allergies}
                onChange={(e) => handleHealthProfileChange("allergies", e.target.value)}
                maxLength={1000}
                className="mt-1 w-full border rounded p-2 min-h-24"
              />
            </label>

            <label className="block text-sm text-slate-700">
              Medical history summary
              <textarea
                value={healthProfile.medicalHistorySummary}
                onChange={(e) => handleHealthProfileChange("medicalHistorySummary", e.target.value)}
                maxLength={3000}
                className="mt-1 w-full border rounded p-2 min-h-28"
              />
            </label>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:bg-slate-500 text-sm"
            >
              {savingProfile ? "Saving..." : "Save Health Profile"}
            </button>

            {profileMessage ? <p className="text-sm text-slate-700">{profileMessage}</p> : null}
          </form>
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