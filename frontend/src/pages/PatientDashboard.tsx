import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAiPrediction, getPersonalInsights } from "../services/Api";


type CountItem = { name: string; count: number };

type PersonalInsightsResponse = {
  days: number;
  insights: {
    activity: {
      pctDaysWithSymptoms: number;
      pctDaysWithFood: number;
      pctDaysWithMedication: number;
      daysWithSymptoms: number;
      daysWithFood: number;
      daysWithMedication: number;
    };
    counts: {
      foodsLogged: number;
      medicationsLogged: number;
      symptomsLogged: number;
    };
    symptoms: {
      avgSeverity: number | null;
      topSymptoms: CountItem[];
    };
    food: {
      topFoods: CountItem[];
    };
    medications: {
      topMedications: CountItem[];
    };
    calories: {
      totalCalories: number | null;
    };
  };
};

type AiPredictResponse = {
  status?: string;
  message?: string;
  riskScore: number | null; // 0..1
  model: string | null;
  featuresUsed?: Record<string, number>;
  correlationSummary?: Array<{ type: string; message: string }>;
};

function PatientDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [insights, setInsights] = useState<PersonalInsightsResponse | null>(null);
  const [ai, setAi] = useState<AiPredictResponse | null>(null);
  const retryOnceRef = useRef(false);
  const lastAiFetchRef = useRef(0);
  const lastInsightsFetchRef = useRef(0);
  const aiTimeoutMs = 7000;
  const insightsTimeoutMs = 10000;

  // dashboard as a weekly snapshot
  const days = 7;

  useEffect(() => {
    let mounted = true;

    const withTimeout = (p: Promise<any>, ms: number) =>
      Promise.race([
        p,
        new Promise((_resolve, reject) =>
          setTimeout(() => reject({ error: "timeout", status: 504 }), ms)
        ),
      ]);

    const load = async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
        setErrorMsg(null);
      }

      try {
        const now = Date.now();
        const canFetchInsights = now - lastInsightsFetchRef.current > 15000;
        const canFetchAi = now - lastAiFetchRef.current > 30000;

        // Fetch both if AI fails, still render the insights
        const [insRes, aiRes] = await Promise.allSettled([
          canFetchInsights
            ? withTimeout(getPersonalInsights(days), insightsTimeoutMs)
            : Promise.reject({ error: "cooldown", status: 429 }),
          canFetchAi
            ? withTimeout(getAiPrediction(), aiTimeoutMs)
            : Promise.reject({ error: "cooldown", status: 429 }),
        ]);

        if (!mounted) return;

        if (insRes.status === "fulfilled") {
          setInsights(insRes.value as PersonalInsightsResponse);
          lastInsightsFetchRef.current = now;
        } else {
          throw insRes.reason;
        }

        if (aiRes.status === "fulfilled") {
          setAi(aiRes.value as AiPredictResponse);
          lastAiFetchRef.current = now;
        } else {
          setAi(null);
        }
      } catch (err: any) {
        const status = err?.status;
        if (status === 401) {
          setErrorMsg("Session expired. Please login again.");
          navigate("/login");
        } else if (status === 429) {
          setErrorMsg("Too many requests right now. Retrying shortly...");
          setTimeout(() => {
            if (mounted) load({ silent: true });
          }, 15000);
        } else if (status === 504) {
          setErrorMsg("Insights are taking longer than usual. Please wait or try refresh.");
        } else {
          setErrorMsg(err?.error || "Failed to load dashboard data.");
        }

        if (!retryOnceRef.current) {
          retryOnceRef.current = true;
          setTimeout(() => {
            if (mounted) load({ silent: true });
          }, 1200);
        }
      } finally {
        if (mounted && !silent) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const riskPct = useMemo(() => {
    const raw = ai?.riskScore;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.round(clamped * 100);
  }, [ai]);

  const recentSymptoms = useMemo(() => {
    const rows = insights?.insights?.symptoms?.topSymptoms || [];
    return rows.slice(0, 3);
  }, [insights]);

  const recentMeds = useMemo(() => {
    const rows = insights?.insights?.medications?.topMedications || [];
    return rows.slice(0, 3);
  }, [insights]);

  const recentFoods = useMemo(() => {
    const rows = insights?.insights?.food?.topFoods || [];
    return rows.slice(0, 3);
  }, [insights]);
  const barWidth = (pct: number | null) => `${Math.max(0, Math.min(100, pct ?? 0))}%`;

  const symptomStabilityPct = useMemo(() => {
    // lower avg severity = higher stability
    const avg = insights?.insights?.symptoms?.avgSeverity;
    if (typeof avg !== "number" || !Number.isFinite(avg)) return 0;
    const stability = 100 - (avg / 10) * 100;
    return Math.max(0, Math.min(100, Math.round(stability)));
  }, [insights]);

  const symptomStabilityLabel = useMemo(() => {
    const avg = insights?.insights?.symptoms?.avgSeverity;
    if (typeof avg !== "number" || !Number.isFinite(avg)) return "Unknown";
    if (avg <= 3) return "Stable";
    if (avg <= 6) return "Some ups and downs";
    return "Unstable";
  }, [insights]);

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">

      <h1 className="text-3xl font-bold mb-4">Patient Dashboard</h1>

      <p className="text-slate-700 mb-8">
        Welcome. Use this dashboard to manage your daily health data and view personalised insights.
      </p>

      {!loading && errorMsg ? (
        <div className="bg-white p-6 rounded-xl shadow mb-6">
          <p className="text-red-700 font-semibold">Could not load dashboard</p>
          <p className="text-slate-700 mt-2 text-sm">{errorMsg}</p>
        </div>
      ) : null}

      {/* Patient tool cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Manage Profile */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">My Health Profile</h2>
          <p className="text-sm text-slate-600 mt-1">
            View and update your personal health information such as conditions and allergies.
          </p>

          <button
            className="mt-4 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
            onClick={() => navigate("/patient/profile")}
          >
            Manage Profile
          </button>
        </div>

        {/* ------ Symptoms Log ----- */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Symptoms Log</h2>

          <p className="text-sm text-slate-600 mt-1 mb-3">
            Track daily symptoms to help monitor condition trends.
          </p>

          {/* Recently logged symptoms */}
          <ul className="text-sm text-slate-700 space-y-2 mb-4">
            {recentSymptoms.length === 0 ? (
              <li className="text-slate-600">No symptoms logged in the last {days} days.</li>
            ) : (
              recentSymptoms.map((s) => (
                <li key={`sym-${s.name}`} className="flex justify-between">
                  <span className="truncate pr-3">{s.name}</span>
                  <span className="text-xs text-slate-500">{s.count}</span>
                </li>
              ))
            )}
          </ul>

          <button
            className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
            onClick={() => navigate("/patient/log?tab=symptoms")}
          >
            Log Symptoms
          </button>
        </div>

        {/* ---- Food/Medication Log ------*/}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">Food & Medication</h2>

          <p className="text-sm text-slate-600 mt-1 mb-4">
            Record food intake and medications taken throughout the day.
          </p>

          {/* Medication section */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Recent Medications (top)
            </h3>

            <ul className="text-sm text-slate-700 space-y-2">
              {recentMeds.length === 0 ? (
                <li className="text-slate-600">No medication logs in the last {days} days.</li>
              ) : (
                recentMeds.map((m) => (
                  <li key={`med-${m.name}`} className="flex justify-between">
                    <span className="truncate pr-3">{m.name}</span>
                    <span className="text-xs text-slate-500">{m.count}</span>
                  </li>
                ))
              )}
            </ul>

            <button
              className="mt-3 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
              onClick={() => navigate("/patient/log?tab=medication")}
            >
              Log Medication
            </button>
          </div>

          {/* Food section */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent Meals (top)</h3>

            <ul className="text-sm text-slate-700 space-y-2">
              {recentFoods.length === 0 ? (
                <li className="text-slate-600">No food logs in the last {days} days.</li>
              ) : (
                recentFoods.map((f) => (
                  <li key={`food-${f.name}`} className="flex justify-between">
                    <span className="truncate pr-3">{f.name}</span>
                    <span className="text-xs text-slate-500">{f.count}</span>
                  </li>
                ))
              )}
            </ul>

            <button
              className="mt-3 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
              onClick={() => navigate("/patient/log?tab=food")}
            >
              Log Food
            </button>
          </div>
        </div>

        {/*---- AI Insights --- */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold">AI Insights</h2>

          <p className="text-sm text-slate-600 mt-1 mb-4">
            Visual summary based on your recent logs (last {days} days).
          </p>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 mb-1">Flare-up Risk (Last {days} Days)</p>
              <div className="w-full bg-slate-200 rounded h-3">
                <div className="bg-slate-900 h-3 rounded" style={{ width: barWidth(riskPct) }} />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {riskPct !== null ? `${riskPct}%` : "Unavailable"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Medication Consistency</p>
              <div className="w-full bg-slate-200 rounded h-3">
                <div
                  className="bg-emerald-600 h-3 rounded"
                  style={{
                    width: barWidth(insights?.insights?.activity?.pctDaysWithMedication ?? 0),
                  }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {insights?.insights?.activity?.pctDaysWithMedication ?? 0}% days logged
                {typeof insights?.insights?.activity?.daysWithMedication === "number"
                  ? ` (${insights.insights.activity.daysWithMedication}/${days} days)`
                  : ""}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1">Symptom Stability</p>
              <div className="w-full bg-slate-200 rounded h-3">
                <div
                  className="bg-amber-500 h-3 rounded"
                  style={{ width: barWidth(symptomStabilityPct) }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{symptomStabilityLabel}</p>
            </div>
          </div>

          <button
            className="mt-5 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
            onClick={() => navigate("/patient/insights")}
          >
            View Detailed Insights
          </button>

          <p className="text-xs text-slate-400 mt-3">
            AI analysis is informational only and does not replace professional medical advice.
          </p>
        </div>

        {/* ---- Notifications---- */}
        <div className="bg-white p-6 rounded-xl shadow md:col-span-2">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="text-sm text-slate-600 mt-1">
            Placeholder for real-time system alerts and reminders (Socket.io planned).
          </p>
        </div>

      </div>

    </div>
  );
}

export default PatientDashboard;