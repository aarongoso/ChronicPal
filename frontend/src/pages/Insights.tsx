import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAiCorrelations, getAiPrediction, getPersonalInsights } from "../services/Api";
import checkIcon from "../icons/check.png";
import errorIcon from "../icons/error.png";
import medicineIcon from "../icons/medicine.png";
import vegetableIcon from "../icons/vegetable.png";
import examIcon from "../icons/examination.png";

// Insights combines AI summaries + personal stats (summary only, no raw rows)
// AI notes are built server side from correlations and returned as aiCards
// riskScore comes from the ML service (logistic regression baseline, 0..1 probability)
// The ML payload uses anonymised signals only (counts/avg severity/calories), not PII
// Lightweight types for safer rendering
type CountItem = { name: string; count: number };
type SeverityBucket = { severity: number; count: number };
type DailySeverityPoint = { day: string; avgSeverity: number | null; count: number };

// summary only medication view
type MedicationDailyPoint = { day: string; count: number; medications: string[] };

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
      severityDistribution: SeverityBucket[];
      topSymptoms: CountItem[];
      dailyAvgSeverity?: DailySeverityPoint[];
    };
    food: { topFoods: CountItem[] };
    medications: {
      topMedications: CountItem[];
      medicationDaily?: MedicationDailyPoint[];
    };
    calories: {
      entriesWithCalories: number;
      totalCalories: number | null;
      avgCaloriesPerEntry: number | null;
    };
    notes: string[];
  };
};

// /ai/predict response (riskScore + AI notes)
type AiPredictResponse = {
  riskScore: number | null; // 0..1 probability from ML service
  model: string | null;
  featuresUsed?: Record<string, number>;
  status?: string;
  message?: string;
  correlationSummary?: Array<{ type: string; message: string }>; // explainable timing notes
  aiCards?: Array<{
    id: string;
    title: string;
    summary: string;
    evidence: {
      mealsCount: number;
      symptomLogsCount: number;
      medicationLogsCount: number;
      days: number;
    };
    confidence: "LOW" | "MEDIUM" | "HIGH";
    conditions?: string[];
    nextStep: string;
    disclaimer?: string;
  }>;
};

type AiCorrelationsResponse = {
  windowDays: number;
  topFoods?: Array<{ name: string; count: number }>;
  topMedications?: Array<{ name: string; count: number }>;
  topSymptoms?: Array<{ name: string; count: number }>;
  nutritionSummary?: {
    totalCaloriesKcal: number | null;
    avgCaloriesKcal: number | null;
    entriesWithCalories: number;
  };
  correlationSummary?: Array<{ type: string; message: string }>;
};


const StatCard: React.FC<{ title: string; value: string; sub?: string }> = ({
  title,
  value,
  sub,
}) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub ? <p className="text-xs text-slate-500 mt-1">{sub}</p> : null}
    </div>
  );
};

const CircleProgress: React.FC<{ pct: number; color?: string }> = ({ pct, color }) => {
  // clamp percent for safe SVG rendering
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 26;
  const stroke = 6;
  const norm = 2 * Math.PI * radius;
  const offset = norm - (clamped / 100) * norm;
  const strokeColor = color || "#0f172a";

  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle
        cx="34"
        cy="34"
        r={radius}
        stroke="#e2e8f0"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx="34"
        cy="34"
        r={radius}
        stroke={strokeColor}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={norm}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="38" textAnchor="middle" fontSize="12" fill="#0f172a">
        {clamped}%
      </text>
    </svg>
  );
};

const ActivityCard: React.FC<{ title: string; pct: number; sub: string; color?: string }> = ({
  title,
  pct,
  sub,
  color,
}) => {
  return (
    <div className="bg-white p-5 rounded-xl shadow flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-slate-500">{title}</p>
        <p className="text-2xl font-bold mt-1">{sub}</p>
      </div>
      <CircleProgress pct={pct} color={color} />
    </div>
  );
};

const SimpleList: React.FC<{ title: string; items: CountItem[]; iconSrc?: string }> = ({
  title,
  items,
  iconSrc,
}) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <div className="flex items-center gap-2">
        {iconSrc ? (
          <img src={iconSrc} alt="" className="h-5 w-5" />
        ) : null}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600 mt-2">No data in this period.</p>
      ) : (
        <ul className="text-sm text-slate-700 mt-3 space-y-2">
          {items.map((it) => (
            <li key={`${title}-${it.name}`} className="flex justify-between">
              <span className="truncate pr-3">{it.name}</span>
              <span className="text-xs text-slate-500">{it.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SeverityTrendChart: React.FC<{ points: DailySeverityPoint[] }> = ({ points }) => {
  const filtered = (points || []).filter((p) => typeof p.avgSeverity === "number") as Array<{
    day: string;
    avgSeverity: number;
    count: number;
  }>;

  if (filtered.length < 2) {
    // need at least two points for a trend line
    return (
      <p className="text-sm text-slate-600 mt-3">
        Not enough symptom data to show a trend yet.
      </p>
    );
  }

  // SVG severity chart
  const width = 760;
  const height = 220;
  const padding = 28;

  const values = filtered.map((p) => p.avgSeverity);
  const minY = Math.min(...values, 1);
  const maxY = Math.max(...values, 10);

  const xStep = (width - padding * 2) / (filtered.length - 1);

  const scaleY = (val: number) => {
    const denom = maxY - minY || 1;
    const t = (val - minY) / denom;
    return height - padding - t * (height - padding * 2);
  };

  const polyPoints = filtered
    .map((p, i) => {
      const x = padding + i * xStep;
      const y = scaleY(p.avgSeverity);
      return `${x},${y}`;
    })
    .join(" ");

  const startLabel = filtered[0].day;
  const endLabel = filtered[filtered.length - 1].day;
  const minPoint = filtered.reduce((acc, p) => (p.avgSeverity < acc.avgSeverity ? p : acc));
  const maxPoint = filtered.reduce((acc, p) => (p.avgSeverity > acc.avgSeverity ? p : acc));

  return (
    <div className="mt-4 overflow-x-auto">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* grid */}
        {[1, 3, 5, 7, 9].map((v) => {
          const y = scaleY(v);
          return (
            <g key={`grid-${v}`}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text x={8} y={y + 4} fontSize="10" fill="#94a3b8">
                {v}
              </text>
            </g>
          );
        })}

        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#94a3b8"
          strokeWidth="1"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#94a3b8"
          strokeWidth="1"
        />

        <polyline fill="none" stroke="#0f172a" strokeWidth="3" points={polyPoints} />

        {filtered.map((p, i) => {
          const x = padding + i * xStep;
          const y = scaleY(p.avgSeverity);
          return (
            <g key={`pt-${p.day}-${i}`}>
              <circle cx={x} cy={y} r="4" fill="#0f172a" />
              <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill="#0f172a">
                {p.avgSeverity.toFixed(1)}
              </text>
              <title>
                {p.day}: {p.avgSeverity.toFixed(1)} (n={p.count})
              </title>
            </g>
          );
        })}

        {/* highlights */}
        <circle
          cx={padding + filtered.findIndex((p) => p.day === maxPoint.day) * xStep}
          cy={scaleY(maxPoint.avgSeverity)}
          r="6"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
        />
        <circle
          cx={padding + filtered.findIndex((p) => p.day === minPoint.day) * xStep}
          cy={scaleY(minPoint.avgSeverity)}
          r="6"
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
        />
      </svg>

      <div className="flex justify-between text-xs text-slate-500 mt-2">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-2">
        <span className="text-rose-600">
          Highest: {maxPoint.day} ({maxPoint.avgSeverity.toFixed(1)})
        </span>
        <span className="text-emerald-600">
          Lowest: {minPoint.day} ({minPoint.avgSeverity.toFixed(1)})
        </span>
      </div>
    </div>
  );
};

const MedicationWeekGrid: React.FC<{ items: MedicationDailyPoint[]; days: number }> = ({
  items,
  days,
}) => {
  // always show last 7 days as a simple tracker
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const byDay: Record<string, MedicationDailyPoint> = {};
  (items || []).forEach((d) => {
    byDay[d.day] = d;
  });

  const cells = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const key = dt.toISOString().slice(0, 10);
    cells.push({ key, dt, data: byDay[key] });
  }

  const dayLabel = (dt: Date) => dt.toLocaleDateString(undefined, { weekday: "short" });
  const shortDate = (dt: Date) =>
    dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });

  return (
    <div className="bg-white p-6 rounded-xl shadow mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Medication Tracker (last 7 days)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Quick tick-off view to help you remember your routine.
          </p>
        </div>

        <button
          className="px-3 py-1.5 rounded text-sm border bg-white hover:bg-slate-50"
          onClick={() => window.location.assign("/patient/log?tab=medication")}
        >
          Log medication
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-3 mt-5">
        {cells.map((c) => {
          const taken = !!c.data && c.data.count > 0;
          const label = taken ? (c.data?.medications || []).slice(0, 2).join(", ") : "";

          return (
            <div
              key={`med-cell-${c.key}`}
              className={`rounded-lg border p-3 ${
                taken ? "bg-slate-50 border-slate-300" : "bg-white"
              }`}
              title={taken ? label : "No medication logged"}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{dayLabel(c.dt)}</p>
                  <p className="text-xs text-slate-500">{shortDate(c.dt)}</p>
                </div>

                <div className="h-6 w-6 flex items-center justify-center">
                  <img
                    src={taken ? checkIcon : errorIcon}
                    alt=""
                    className="h-6 w-6"
                  />
                </div>
              </div>

              {taken ? (
                <div className="mt-2">
                  <p className="text-xs text-slate-600">
                    {c.data?.count} {c.data?.count === 1 ? "entry" : "entries"}
                  </p>
                  {label ? (
                    <p className="text-xs text-slate-700 mt-1 truncate">
                      {label}
                      {(c.data?.medications || []).length > 2 ? "…" : ""}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">No log</p>
              )}
            </div>
          );
        })}
      </div>

      {days !== 7 ? (
        <p className="text-xs text-slate-400 mt-4">
          You selected {days} days. The tracker stays at 7 days so it's easier to read.
        </p>
      ) : null}
    </div>
  );
};

function Insights() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  useEffect(() => {
    // guardrail only, backend still enforces RBAC
    if (role && role !== "patient") {
      navigate("/");
    }
  }, [role, navigate]);

  const [days, setDays] = useState<number>(7);

  const [data, setData] = useState<PersonalInsightsResponse | null>(null);
  const [aiPred, setAiPred] = useState<AiPredictResponse | null>(null);
  const [aiCorr, setAiCorr] = useState<AiCorrelationsResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const aiTimeoutMs = 7000;
  const insightsTimeoutMs = 10000;

  const withTimeout = (p: Promise<any>, ms: number) =>
    Promise.race([
      p,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject({ error: "timeout", status: 504 }), ms)
      ),
    ]);

  const fetchInsights = useCallback(async (d: number) => {
    setLoading(true);
    setErrorMsg(null);

    try {
      // if AI fails we still show personal insights
      const [insRes, predRes, corrRes] = await Promise.allSettled([
        withTimeout(getPersonalInsights(d), insightsTimeoutMs),
        withTimeout(getAiPrediction(d), aiTimeoutMs),
        withTimeout(getAiCorrelations(d), aiTimeoutMs),
      ]);

      if (insRes.status === "fulfilled") {
        setData(insRes.value as PersonalInsightsResponse);
      } else {
        throw insRes.reason;
      }

      if (predRes.status === "fulfilled") {
        setAiPred(predRes.value as AiPredictResponse);
      } else {
        setAiPred(null);
      }

      if (corrRes.status === "fulfilled") {
        setAiCorr(corrRes.value as AiCorrelationsResponse);
      } else {
        setAiCorr(null);
      }

    } catch (err: any) {
      const status = err?.status;

      if (status === 403) {
        setErrorMsg("Session expired or access denied. Please log in again as a patient.");
      } else if (status === 401) {
        setErrorMsg("Session expired. Please login again.");
        navigate("/login");
      } else if (status === 504) {
        setErrorMsg("Insights are taking longer than usual. Please wait or try refresh.");
      } else {
        setErrorMsg(err?.error || "Failed to load insights.");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchInsights(days);
  }, [days, fetchInsights]);

  const headerDaysLabel = days === 7 ? "Last 7 days" : `Last ${days} days`;

  const riskPct = useMemo(() => {
    // normalize ML probability to a percent for ui
    const raw = aiPred?.riskScore;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
    const clamped = Math.max(0, Math.min(1, raw));
    return Math.round(clamped * 100);
  }, [aiPred]);

  const riskLevel = useMemo(() => {
    if (riskPct === null) {
      return { label: "Unavailable", tone: "bg-slate-100 text-slate-600 border-slate-200" };
    }
    if (riskPct < 35) {
      return { label: "Low", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (riskPct < 65) {
      return { label: "Moderate", tone: "bg-amber-50 text-amber-700 border-amber-200" };
    }
    return { label: "High", tone: "bg-rose-50 text-rose-700 border-rose-200" };
  }, [riskPct]);

  const foodMeta = useMemo(() => {
    // foodMeta is injected server side inside correlationSummary (type: meta)
    const items = aiPred?.correlationSummary || [];
    return (
      items.find(
        (c: any) => Array.isArray(c?.riskFoods) || Array.isArray(c?.safeFoods)
      ) || null
    );
  }, [aiPred]);

  const riskFoods = useMemo(() => {
    return Array.isArray((foodMeta as any)?.riskFoods) ? (foodMeta as any).riskFoods : [];
  }, [foodMeta]);

  const safeFoods = useMemo(() => {
    return Array.isArray((foodMeta as any)?.safeFoods) ? (foodMeta as any).safeFoods : [];
  }, [foodMeta]);

  const severityTrendLabel = useMemo(() => {
    // quick label to make the trend easy to read
    const points = data?.insights?.symptoms?.dailyAvgSeverity || [];
    const filtered = points.filter((p) => typeof p.avgSeverity === "number") as Array<{
      day: string;
      avgSeverity: number;
      count: number;
    }>;
    if (filtered.length < 2) return null;
    const first = filtered[0].avgSeverity;
    const last = filtered[filtered.length - 1].avgSeverity;
    const delta = last - first;
    if (Math.abs(delta) < 0.5) return "Stable";
    return delta > 0 ? "Rising" : "Improving";
  }, [data]);

  const aiCards = useMemo(() => {
    // AI cards are already summarised server side (no raw logs returned)
    // Each card explains a pattern + next step, not a medical diagnosis
    return Array.isArray(aiPred?.aiCards) ? aiPred?.aiCards : [];
  }, [aiPred]) as NonNullable<AiPredictResponse["aiCards"]>;

  const dataQualityNudge = useMemo(() => {
    if (!data) return null;
    const maxDays = Math.max(
      data.insights.activity.daysWithSymptoms || 0,
      data.insights.activity.daysWithFood || 0,
      data.insights.activity.daysWithMedication || 0
    );
    const need = Math.max(0, 3 - maxDays);
    if (need <= 0) return null;
    return `Log ${need} more day${need === 1 ? "" : "s"} for clearer insights.`;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-100 p-8 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Personal Insights</h1>
          <p className="text-slate-700 mt-1">
            Summary based only on your own logs ({headerDaysLabel}).
          </p>
        </div>

        <button
          className="px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 text-sm"
          onClick={() => navigate("/patient")}
        >
          Back to Dashboard
        </button>
      </div>

      {/* Days toggle */}
      <div className="bg-white p-4 rounded-xl shadow mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Time window</p>
          <p className="text-xs text-slate-500">
            Use 7 days for weekly patterns, 30 for a broader view.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded text-sm border ${
              days === 7 ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
            }`}
            onClick={() => setDays(7)}
            disabled={loading}
          >
            7 days
          </button>
          <button
            className={`px-3 py-1.5 rounded text-sm border ${
              days === 30 ? "bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
            }`}
            onClick={() => setDays(30)}
            disabled={loading}
          >
            30 days
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-slate-700">Loading insights...</p>
        </div>
      ) : null}

      {!loading && errorMsg ? (
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-red-700 font-semibold">Could not load insights</p>
          <p className="text-slate-700 mt-2 text-sm">{errorMsg}</p>
        </div>
      ) : null}

      {!loading && !errorMsg && data ? (
        <>
          {/* Flare-up Risk (ML probability shown as a percent) */}
          <div className="bg-white p-6 rounded-xl shadow mb-6">
            <h2 className="text-lg font-semibold">Flare-up Risk</h2>
            <p className="text-xs text-slate-500 mt-1">
              A calculation of your flare-up chance based on your recent symptoms, food, and medication logs.
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
              <div className="bg-slate-50 rounded-lg p-4 border">
                <p className="text-xs text-slate-500">Estimated chance</p>
                <p className="text-3xl font-bold mt-1">
                  {riskPct !== null ? `${riskPct}%` : "Unavailable"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${riskLevel.tone}`}
                  >
                    {riskLevel.label} risk
                  </span>
                </div>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-slate-500 mb-1">Suggested foods</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-600">
                      Suggested risky foods
                    </p>
                    {riskFoods.length > 0 ? (
                      <ul className="text-xs text-slate-700 mt-2 list-disc pl-5 space-y-1">
                        {riskFoods.map((f: string) => (
                          <li key={`risk-food-${f}`}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 mt-2">
                        Not enough data yet.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">
                      Suggested safe foods
                    </p>
                    {safeFoods.length > 0 ? (
                      <ul className="text-xs text-slate-700 mt-2 list-disc pl-5 space-y-1">
                        {safeFoods.map((f: string) => (
                          <li key={`safe-food-${f}`}>{f}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 mt-2">
                        Not enough data yet.
                      </p>
                    )}
                  </div>
                </div>


                <p className="text-xs text-slate-400 mt-2">
                  Informational only. Not medical advice.
                </p>
              </div>
            </div>
          </div>
          {/* AI Insight Cards (built server-side from correlations + risk tags) */}
          <div className="bg-white p-6 rounded-xl shadow mb-6">
            <h2 className="text-lg font-semibold">AI Notes</h2>
            <p className="text-xs text-slate-500 mt-1">
              Confidence guide: High = seen often. Medium = some pattern. Low = limited data.
            </p>
            {dataQualityNudge ? (
              <p className="text-xs text-slate-600 mt-2">{dataQualityNudge}</p>
            ) : null}

            {aiCards.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiCards.map((card) => (
                  <div key={card.id} className="border rounded-lg p-4 bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-800">{card.title}</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border ${
                          card.confidence === "HIGH"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : card.confidence === "MEDIUM"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {card.confidence} confidence
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-2">{card.summary}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {card.id === "med-consistency"
                        ? `Based on your last ${card.evidence.days} days: ${card.evidence.medicationLogsCount} medication logs.`
                        : card.id === "flare-risk"
                        ? `Based on your last ${card.evidence.days} days: ${card.evidence.symptomLogsCount} symptom logs, ${card.evidence.mealsCount} meals.`
                        : `Based on your last ${card.evidence.days} days: ${card.evidence.mealsCount} meals, ${card.evidence.symptomLogsCount} symptom logs.`}
                    </p>
                    {Array.isArray(card.conditions) && card.conditions.length > 0 ? (
                      <p className="text-xs text-slate-500 mt-2">
                        Mostly when: {card.conditions.join(", ")}.
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-700 mt-3">
                      Try next: {card.nextStep}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 mt-3">
                No AI notes available yet. Log more symptoms, foods, and medications.
              </p>
            )}

            <p className="text-xs text-slate-400 mt-3">
              The more data logged, the more accurate results are. Informational only. Not medical advice.
            </p>
          </div>

          {/* Activity cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <ActivityCard
              title="Days with symptoms"
              pct={data.insights.activity.pctDaysWithSymptoms}
              sub={`${data.insights.activity.daysWithSymptoms} / ${data.days} days`}
              color="#f59e0b"
            />
            <ActivityCard
              title="Days with food logs"
              pct={data.insights.activity.pctDaysWithFood}
              sub={`${data.insights.activity.daysWithFood} / ${data.days} days`}
              color="#0f172a"
            />
            <ActivityCard
              title="Days with medication logs"
              pct={data.insights.activity.pctDaysWithMedication}
              sub={`${data.insights.activity.daysWithMedication} / ${data.days} days`}
              color="#10b981"
            />
          </div>

          {/* Trend chart */}
          <div className="bg-white p-6 rounded-xl shadow mb-6">
            <h2 className="text-lg font-semibold">Severity Trend</h2>
            <p className="text-xs text-slate-500 mt-1">
              Daily average symptom severity over your selected time window.
            </p>

            <SeverityTrendChart
              key={`severity-trend-${days}`} // stops stale SVG when switching 7/30
              points={data.insights.symptoms.dailyAvgSeverity || []}
            />
            <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-500">Higher line = more severe symptoms</p>
              {severityTrendLabel ? (
                <span className="text-xs px-2 py-0.5 rounded border bg-slate-50 text-slate-700">
                  Trend: {severityTrendLabel}
                </span>
              ) : null}
            </div>
          </div>

          {/* Medication weekly tracker */}
          {Array.isArray(data.insights.medications.medicationDaily) ? (
            <MedicationWeekGrid
              items={data.insights.medications.medicationDaily || []}
              days={days}
            />
          ) : null}

          {/* Counts + calories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 mt-6">
            <StatCard
              title="Symptoms logged"
              value={`${data.insights.counts.symptomsLogged}`}
              sub="Tracks your symptoms over time."
            />
            <StatCard
              title="Food entries logged"
              value={`${data.insights.counts.foodsLogged}`}
              sub="Meals and snacks recorded."
            />
            <StatCard
              title="Medication entries logged"
              value={`${data.insights.counts.medicationsLogged}`}
              sub="Medication intake recorded."
            />
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SimpleList
              title="Most common symptoms"
              items={aiCorr?.topSymptoms || []}
              iconSrc={examIcon}
            />
            <SimpleList
              title="Most common foods"
              items={aiCorr?.topFoods || []}
              iconSrc={vegetableIcon}
            />
            <SimpleList
              title="Most common medications"
              items={aiCorr?.topMedications || []}
              iconSrc={medicineIcon}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export default Insights;