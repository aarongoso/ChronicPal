const { matchedData, validationResult } = require("express-validator");
const { Op } = require("sequelize");

const MlServiceClient = require("../utils/external/MlServiceClient");
const { logAudit } = require("../utils/auditLogger");

// SymptomLog is now required for symptom -> flare-up AI
const { FoodLog, MedicationLog, SymptomLog } = require("../config/db");

// extract userId from authenticated request
function getUserIdSafe(req: any): number | null {
  return req?.user?.id ?? null;
}

// Normalise names so "Apple" and "apple " count as the same item
function normaliseKey(value: any): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

async function auditAi(req: any, action: string, details: any = {}) {
  const userId = getUserIdSafe(req);
  const ipAddress = req.ip || req.connection?.remoteAddress || "unknown";
  await logAudit(userId, action, ipAddress, details);
}

// clamp AI window (days) to avoid heavy queries
// Keeping small max prevents users forcing huge DB reads
function parseWindowDays(req: any): number {
  const daysRaw = parseInt(String(req.query.days || req.body?.days || "14"), 10);
  const days = Number.isFinite(daysRaw) ? Math.min(Math.max(daysRaw, 1), 90) : 14;
  return days;
}

// anonymised payload from DB logs
// Only sends signals needed for modelling (severity, calories, counts, timestamps)
async function buildAiPayloadFromDb(userId: number, windowDays: number) {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // Symptoms are core signal for flareup prediction
  const symptomRows = await SymptomLog.findAll({
    where: {
      userId,
      loggedAt: { [Op.gte]: since },
    },
    attributes: ["symptomName", "severity", "loggedAt"],
    order: [["loggedAt", "DESC"]],
    limit: 500, // defensive cap
  });

  const foodRows = await FoodLog.findAll({
    where: {
      userId,
      consumedAt: { [Op.gte]: since },
    },
    attributes: ["name", "caloriesKcal", "consumedAt"],
    order: [["consumedAt", "DESC"]],
    limit: 500,
  });

  const medRows = await MedicationLog.findAll({
    where: {
      userId,
      takenAt: { [Op.gte]: since },
    },
    attributes: ["medicationName", "takenAt"],
    order: [["takenAt", "DESC"]],
    limit: 500,
  });

  // Map to anonymised DTOs
  const symptoms = symptomRows.map((r: any) => ({
    name: r.symptomName,
    severity:
      typeof r.severity === "number"
        ? r.severity
        : parseInt(String(r.severity), 10),
    loggedAt: r.loggedAt,
  }));

  const foodLogs = foodRows.map((r: any) => ({
    name: r.name,
    caloriesKcal: typeof r.caloriesKcal === "number" ? r.caloriesKcal : null,
    consumedAt: r.consumedAt,
  }));

  const medicationLogs = medRows
    .map((r: any) => ({
      name: r.medicationName,
      takenAt: r.takenAt,
    }))
    // strip noise so model isnt trained on placeholder values
    .filter(
      (x: any) =>
        x.name && String(x.name).trim().toLowerCase() !== "unknown medication"
    );

  return {
    windowDays,
    counts: {
      symptoms: symptoms.length,
      foodLogs: foodLogs.length,
      medicationLogs: medicationLogs.length,
    },
    payload: {
      symptoms,
      foodLogs,
      medicationLogs,
    },
    // Keeping rawRows internal only (not returned to client)
    // tcorrelations need timestamps, but ML has to stay anonymised
    _internalRows: {
      symptomRows,
      foodRows,
      medRows,
    },
  };
}

// Rule is there enough data to call ML, prevents calling ML with meaningless input
function hasEnoughData(payload: any): boolean {
  const symptomCount = Array.isArray(payload.symptoms) ? payload.symptoms.length : 0;
  const foodCount = Array.isArray(payload.foodLogs) ? payload.foodLogs.length : 0;
  const medicationCount = Array.isArray(payload.medicationLogs)
    ? payload.medicationLogs.length
    : 0;

  // For flare-up prediction, symptoms matter most; but still allow any 3 combined signals
  return symptomCount + foodCount + medicationCount >= 3;
}

// symptom based correlation builder (timing windows)
// Food looks back 12 hours from symptom event
// Medication looks back 24 hours from symptom event
 
function buildSymptomTimingCorrelations(symptomRows: any[], foodRows: any[], medRows: any[]) {
  if (!Array.isArray(symptomRows) || symptomRows.length < 2) {
    return [
      {
        type: "warning",
        message:
          "More symptom entries are needed before symptom-based correlations can be computed (more data required)",
      },
    ];
  }

  // Baseline severity = mean of all severities in window
  // This gives an explainable "above your normal" threshold 
  const severities = symptomRows
    .map((r: any) => (typeof r.severity === "number" ? r.severity : null))
    .filter((v: any): v is number => typeof v === "number");

  const avgSeverity =
    severities.length > 0
      ? severities.reduce((sum: number, v: number) => sum + v, 0) / severities.length
      : 0;

  const highSeverityThreshold = avgSeverity + 1; // above baseline rule

  // Count "high severity symptom events" that occurred shortly after food/med events
  let highSymptomsAfterFood = 0;
  let highSymptomsAfterMeds = 0;

  const foodHighCounts: Record<string, number> = {};
  const foodSafeCounts: Record<string, number> = {};
  const foodHighSymptomCounts: Record<string, number> = {};
  const foodHighTagCounts: Record<string, number> = {}; // Track tag based patterns from riskTags
  const medHighCounts: Record<string, number> = {};
  const medHighSymptomCounts: Record<string, number> = {};
  const displayNameByKey: Record<string, string> = {};

  for (const s of symptomRows) {
    const sev = typeof s.severity === "number" ? s.severity : null;
    const loggedAt = s.loggedAt ? new Date(s.loggedAt) : null;
    if (sev === null || !loggedAt || isNaN(loggedAt.getTime())) continue;

    // Food window: last 12 hours
    const foodStart = new Date(loggedAt);
    foodStart.setHours(foodStart.getHours() - 12);

    const foodMatch = foodRows.find((f: any) => {
      const t = f.consumedAt ? new Date(f.consumedAt) : null;
      return t && !isNaN(t.getTime()) && t >= foodStart && t <= loggedAt;
    });

    if (foodMatch) {
      const foodName = foodMatch.name ? String(foodMatch.name).trim() : "a food entry";
      const symptomName = s.symptomName ? String(s.symptomName).trim() : "symptoms";
      const foodKey = normaliseKey(foodName) || foodName;
      const symptomKey = normaliseKey(symptomName) || symptomName;
      displayNameByKey[foodKey] = displayNameByKey[foodKey] || foodName;
      displayNameByKey[symptomKey] = displayNameByKey[symptomKey] || symptomName;
      if (sev >= highSeverityThreshold) {
        highSymptomsAfterFood++;
        foodHighCounts[foodKey] = (foodHighCounts[foodKey] || 0) + 1;
        foodHighSymptomCounts[symptomKey] = (foodHighSymptomCounts[symptomKey] || 0) + 1;
        const tags = foodMatch.riskTags; // riskTags stored with food logs
        if (tags && typeof tags === "object" && !Array.isArray(tags)) {
          for (const [key, value] of Object.entries(tags)) {
            if (value === true) {
              foodHighTagCounts[key] = (foodHighTagCounts[key] || 0) + 1;
            }
          }
        }
      }
    }

    // Medication window: last 24 hours
    const medStart = new Date(loggedAt);
    medStart.setHours(medStart.getHours() - 24);

    const medMatch = medRows.find((m: any) => {
      const t = m.takenAt ? new Date(m.takenAt) : null;
      return t && !isNaN(t.getTime()) && t >= medStart && t <= loggedAt;
    });

    if (medMatch && sev >= highSeverityThreshold) {
      const medName = (medMatch.medicationName || medMatch.name)
        ? String(medMatch.medicationName || medMatch.name).trim()
        : "a medication entry";
      const symptomName = s.symptomName ? String(s.symptomName).trim() : "symptoms";
      const medKey = normaliseKey(medName) || medName;
      const symptomKey = normaliseKey(symptomName) || symptomName;
      displayNameByKey[medKey] = displayNameByKey[medKey] || medName;
      displayNameByKey[symptomKey] = displayNameByKey[symptomKey] || symptomName;
      highSymptomsAfterMeds++;
      medHighCounts[medKey] = (medHighCounts[medKey] || 0) + 1;
      medHighSymptomCounts[symptomKey] = (medHighSymptomCounts[symptomKey] || 0) + 1;
    }
  }

  const topKey = (counts: Record<string, number>) => {
    const entries = Object.entries(counts);
    if (entries.length == 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };

  const topList = (counts: Record<string, number>, max: number = 3) => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([key]) => displayNameByKey[key] || key);
  };

  const topListWithCounts = (counts: Record<string, number>, max: number = 5) => {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([name, count]) => ({ name, count }));
  };

  const mixedFoods = () => {
    const mixed: string[] = [];
    for (const name of Object.keys(foodHighCounts)) {
      if (foodSafeCounts[name]) mixed.push(name);
    }
    return mixed.slice(0, 3).map((key) => displayNameByKey[key] || key);
  };

  const topFoodHigh = topKey(foodHighCounts);
  const topFoodHighSymptom = topKey(foodHighSymptomCounts);
  const topFoodHighTag = topKey(foodHighTagCounts);
  const topMedHigh = topKey(medHighCounts);
  const topMedHighSymptom = topKey(medHighSymptomCounts);
  const topFoodHighDisplay = topFoodHigh ? displayNameByKey[topFoodHigh] || topFoodHigh : null;
  const topFoodHighSymptomDisplay = topFoodHighSymptom
    ? displayNameByKey[topFoodHighSymptom] || topFoodHighSymptom
    : null;
  const topMedHighDisplay = topMedHigh ? displayNameByKey[topMedHigh] || topMedHigh : null;
  const topMedHighSymptomDisplay = topMedHighSymptom
    ? displayNameByKey[topMedHighSymptom] || topMedHighSymptom
    : null;

  // Safe foods: foods followed by symptoms, but not higher than usual within 12 hours
  for (const f of foodRows) {
    const consumedAt = f.consumedAt ? new Date(f.consumedAt) : null;
    if (!consumedAt || isNaN(consumedAt.getTime())) continue;

    const foodEnd = new Date(consumedAt);
    foodEnd.setHours(foodEnd.getHours() + 12);

    const symptomsInWindow = symptomRows.filter((s: any) => {
      const t = s.loggedAt ? new Date(s.loggedAt) : null;
      return t && !isNaN(t.getTime()) && t >= consumedAt && t <= foodEnd;
    });

    if (symptomsInWindow.length === 0) continue;

    const hasHigh = symptomsInWindow.some((s: any) => {
      const sev = typeof s.severity === "number" ? s.severity : null;
      return typeof sev === "number" && sev >= highSeverityThreshold;
    });

    if (!hasHigh) {
      const foodName = f.name ? String(f.name).trim() : "a food entry";
      const foodKey = normaliseKey(foodName) || foodName;
      displayNameByKey[foodKey] = displayNameByKey[foodKey] || foodName;
      foodSafeCounts[foodKey] = (foodSafeCounts[foodKey] || 0) + 1;
    }
  }

  const topFoodSafe = topKey(foodSafeCounts);
  const topFoodSafeDisplay = topFoodSafe ? displayNameByKey[topFoodSafe] || topFoodSafe : null;

  const summary: any[] = [
    {
      type: "meta",
      riskFoods: topList(foodHighCounts),
      safeFoods: topList(foodSafeCounts),
      mixedFoods: mixedFoods(),
    },
    {
      type: "info",
      message:
        "These notes look for possible patterns in your recent logs to help you spot triggers and routines.",
    },
  ];

  if (highSymptomsAfterFood > 0) {
    summary.push({
      type: "warning",
      message: topFoodHighDisplay
        ? `Higher-than-usual symptoms (often ${topFoodHighSymptomDisplay || "symptoms"}) occurred after ${topFoodHighDisplay}. Consider reducing or spacing this item and discuss with your clinician if the pattern repeats.`
        : `You had ${highSymptomsAfterFood} higher-than-usual symptom event(s) after a food entry. This may be a food-related pattern to watch.`,
    });
  } else {
    summary.push({
      type: "info",
      message: "No clear food-related pattern was detected in this time window.",
    });
  }

  if (topFoodHighTag && (foodHighTagCounts[topFoodHighTag] || 0) >= 2) {
    const tagLabelMap: Record<string, string> = {
      containsDairy: "dairy",
      containsGluten: "gluten",
      highFibre: "high-fibre",
      spicy: "spicy",
      highFat: "high-fat",
      caffeine: "caffeine",
      alcohol: "alcohol",
      highSugar: "high-sugar",
      highSodium: "high-sodium",
      highIron: "high-iron",
    };
    const label = tagLabelMap[topFoodHighTag] || topFoodHighTag;
    summary.push({
      type: "note",
      message: `Higher-than-usual symptoms often followed foods tagged ${label}. Consider reducing or spacing those items to see if symptoms improve.`,
    });
  }

  if (topFoodSafeDisplay) {
    summary.push({
      type: "note",
      message: `Some foods were not followed by higher-than-usual symptoms within 12 hours (often ${topFoodSafeDisplay}). These may be safer options for you to repeat.`,
    });
  }

  if (highSymptomsAfterMeds > 0) {
    summary.push({
      type: "warning",
      message: topMedHighDisplay
        ? `Higher-than-usual symptoms (often ${topMedHighSymptomDisplay || "symptoms"}) occurred after ${topMedHighDisplay}. Consider noting dose timing and missed doses, and discuss with your clinician if it repeats.`
        : `You had ${highSymptomsAfterMeds} higher-than-usual symptom event(s) after a medication entry. This may be worth discussing with your clinician.`,
    });
  } else {
    summary.push({
      type: "info",
      message: "No clear medication-related pattern was detected in this time window.",
    });
  }

  summary.push({
    type: "note",
    message:
      "These are correlations, not diagnoses. Use them to guide self-care and clinician conversations.",
  });
  summary.push({
    type: "note",
    message:
      "Tip: log symptoms when they start and again if they change later in the day to capture patterns.",
  });
  summary.push({
    type: "note",
    message:
      "Tip: add simple context (sleep, stress, new foods, missed meds) to make patterns clearer.",
  });

  return summary;
}

function buildAiCards(
  meta: any,
  counts: { symptoms: number; foodLogs: number; medicationLogs: number },
  windowDays: number,
  riskScore: number | null
) {
  // insight cards for patient insights page
  const cards: any[] = [];

  const confidenceFromEvents = (events: number) => {
    if (events >= 5) return "HIGH";
    if (events >= 3) return "MEDIUM";
    return "LOW";
  };

  const evidence = {
    mealsCount: counts.foodLogs,
    symptomLogsCount: counts.symptoms,
    medicationLogsCount: counts.medicationLogs,
    days: windowDays,
  };

  const riskFoods: string[] = Array.isArray(meta?.riskFoods) ? meta.riskFoods : [];
  const safeFoods: string[] = Array.isArray(meta?.safeFoods) ? meta.safeFoods : [];
  const mixedFoods: string[] = Array.isArray(meta?.mixedFoods) ? meta.mixedFoods : [];

  if (riskFoods.length > 0) {
    cards.push({
      id: "trigger-foods",
      title: "Top trigger foods",
      summary: `These foods are often followed by higher symptoms: ${riskFoods.join(", ")}.`,
      evidence,
      confidence: confidenceFromEvents(riskFoods.length),
      conditions: [],
      nextStep: "Try a 7‑day break from one item and compare how you feel.",
    });
  }

  if (safeFoods.length > 0) {
    cards.push({
      id: "safe-foods",
      title: "Top safe foods",
      summary: `These foods were not followed by higher symptoms within 12 hours: ${safeFoods.join(
        ", "
      )}.`,
      evidence,
      confidence: confidenceFromEvents(safeFoods.length),
      conditions: [],
      nextStep: "Keep these as go‑to options on flare‑prone days.",
    });
  }

  if (mixedFoods.length > 0) {
    cards.push({
      id: "unclear-foods",
      title: "Unclear foods",
      summary: `These foods are sometimes fine and sometimes not: ${mixedFoods.join(", ")}.`,
      evidence,
      confidence: "LOW",
      conditions: [],
      nextStep: "Log portion size and time for 2 weeks to clarify the pattern.",
    });
  }

  if (counts.medicationLogs > 0) {
    cards.push({
      id: "med-consistency",
      title: "Medication consistency",
      summary: `You logged medication ${counts.medicationLogs} time(s) in the last ${windowDays} days.`,
      evidence,
      confidence: confidenceFromEvents(counts.medicationLogs),
      conditions: [],
      nextStep: "Aim for steady timing and fewer missed days if you can.",
      disclaimer: "This isn’t medical advice—talk to your clinician before changing medication.",
    });
  }

  if (typeof riskScore === "number") {
    const pct = Math.round(Math.max(0, Math.min(1, riskScore)) * 100);
    const riskLabel = pct >= 65 ? "elevated" : pct >= 35 ? "moderate" : "low";
    cards.push({
      id: "flare-risk",
      title: "Flare risk",
      summary: `Your flare risk looks ${riskLabel} right now (about ${pct}%).`,
      evidence,
      confidence: confidenceFromEvents(counts.symptoms),
      conditions: [],
      nextStep: "Choose safe foods, drink water, and avoid known triggers today.",
    });
  }

  return cards;
}

// POST /ai/predict
// Secure backend to ML service
// fetch logs server side for authenticated user, anonymised payload and send it to ML service
async function predictProxy(req: any, res: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "validation_failed",
      details: errors.array(),
    });
  }

  // matchedData keeps only safe values
  const _cleanPayloadFromClient = matchedData(req, { onlyValidData: true });

  const userId = getUserIdSafe(req);
  if (!userId) {
    // shouldnt happen if authenticateToken is mounted properly
    return res.status(401).json({ error: "unauthorised" });
  }

  const windowDays = parseWindowDays(req);

  await auditAi(req, "AI_INFERENCE_REQUEST", {
    status: "requested",
    windowDays,
  });

  try {
    // Build payload from DB
    const built = await buildAiPayloadFromDb(userId, windowDays);

    if (!hasEnoughData(built.payload)) {
      await auditAi(req, "AI_INFERENCE_REQUEST", {
        status: "insufficient_data",
        windowDays,
        counts: built.counts,
      });

      return res.status(200).json({
        status: "insufficient_data",
        message: "More data required to generate reliable AI insights.",
        windowDays,
        counts: built.counts,
        riskScore: null,
        model: null,
        featuresUsed: {},
        aiCards: [],
        correlationSummary: [
          {
            type: "info",
            message:
              "Log more symptoms (severity), foods, and medications to enable flare up predictions and correlations.",
          },
        ],
      });
    }

    // Call ML service with anonymised payload
    const mlResult = await MlServiceClient.predict(built.payload);

    // symptom timing correlations
    const symptomTimingSummary = buildSymptomTimingCorrelations(
      built._internalRows.symptomRows,
      built._internalRows.foodRows,
      built._internalRows.medRows
    );

    const meta = Array.isArray(symptomTimingSummary)
      ? symptomTimingSummary.find((s: any) => s && s.type === "meta")
      : null;

    const aiCards = buildAiCards(meta, built.counts, windowDays, mlResult.riskScore);

    await auditAi(req, "AI_INFERENCE_REQUEST", {
      status: "success",
      windowDays,
      model: mlResult.model,
      riskScore: mlResult.riskScore,
      counts: built.counts,
    });

    return res.status(200).json({
      status: "ok",
      windowDays,
      counts: built.counts,
      riskScore: mlResult.riskScore,
      model: mlResult.model,
      featuresUsed: mlResult.featuresUsed || {},
      aiCards,
      correlationSummary: [
        {
          type: "info",
          message:
            "Predictions are based on your recent symptom, food, and medication history. Correlations improve as you log more data.",
        },
        ...symptomTimingSummary,
      ],
    });
  } catch (error: any) {
    await auditAi(req, "AI_INFERENCE_REQUEST", {
      status: "error",
      windowDays,
      message: error?.message || "ml_service_error",
    });

    return res.status(502).json({
      error: "ml_service_unavailable",
      message: "AI service is temporarily unavailable.",
    });
  }
}

// GET /ai/correlations
// User specific, explainable correlations using existing tables
// include symptom_logs and build symptom timing correlations
async function getCorrelations(req: any, res: any) {
  const userId = getUserIdSafe(req);
  const ip = req.ip || req.connection?.remoteAddress || "unknown";

  try {
    if (!userId) {
      return res.status(401).json({ error: "unauthorised" });
    }

    const days = parseWindowDays(req);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const symptomRows = await SymptomLog.findAll({
      where: {
        userId,
        loggedAt: { [Op.gte]: since },
      },
      attributes: ["symptomName", "severity", "loggedAt"],
      order: [["loggedAt", "DESC"]],
      limit: 500,
    });

    const foodRows = await FoodLog.findAll({
      where: {
        userId,
        consumedAt: { [Op.gte]: since },
      },
      attributes: ["name", "brand", "caloriesKcal", "consumedAt"],
      order: [["consumedAt", "DESC"]],
      limit: 500,
    });

    const medRows = await MedicationLog.findAll({
      where: {
        userId,
        takenAt: { [Op.gte]: since },
      },
      attributes: ["medicationName", "takenAt"],
      order: [["takenAt", "DESC"]],
      limit: 500,
    });

    // Calories only from entries that have calorie data
    const calorieValues = foodRows
      .map((r: any) => (typeof r.caloriesKcal === "number" ? r.caloriesKcal : null))
      .filter((v: any): v is number => typeof v === "number");

    const totalCalories =
      calorieValues.length > 0
        ? calorieValues.reduce((sum: number, v: number) => sum + v, 0)
        : null;

    const avgCalories =
      calorieValues.length > 0 ? totalCalories! / calorieValues.length : null;

    // Top foods
    const foodCounts: Record<string, number> = {};
    for (const r of foodRows) {
      const base = r.name?.trim() || "Unknown food";
      const brand = r.brand ? ` (${r.brand.trim()})` : "";
      const key = `${base}${brand}`;
      foodCounts[key] = (foodCounts[key] || 0) + 1;
    }

    const topFoods = Object.entries(foodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top medications (skip blanks / unknown)
    const medCounts: Record<string, number> = {};
    for (const r of medRows) {
      const name = r.medicationName?.trim();
      if (!name || name.toLowerCase() === "unknown medication") continue;
      medCounts[name] = (medCounts[name] || 0) + 1;
    }

    const topMedications = Object.entries(medCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top symptoms
    const symptomCounts: Record<string, number> = {};
    for (const r of symptomRows) {
      const name = r.symptomName?.trim();
      if (!name) continue;
      symptomCounts[name] = (symptomCounts[name] || 0) + 1;
    }

    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Symptom timing correlations
    // meds reuse same timing analysis but pass medRows in raw form
    const symptomTimingSummary = buildSymptomTimingCorrelations(
      symptomRows,
      foodRows,
      // map to the same shape used in timing helper (takenAt + name)
      medRows.map((m: any) => ({
        takenAt: m.takenAt,
        medicationName: m.medicationName,
      }))
    );

    await logAudit(userId, "AI_CORRELATION_REQUEST", ip, {
      status: "success",
      days,
    });

    return res.json({
      status: "ok",
      windowDays: days,
      counts: {
        symptoms: symptomRows.length,
        foodLogs: foodRows.length,
        medicationLogs: medRows.length,
      },
      nutritionSummary: {
        totalCaloriesKcal:
          typeof totalCalories === "number" ? Math.round(totalCalories) : null,
        avgCaloriesKcal:
          typeof avgCalories === "number" ? Math.round(avgCalories) : null,
        entriesWithCalories: calorieValues.length,
      },
      topFoods,
      topMedications,
      topSymptoms,
      correlationSummary: [
        {
          type: "info",
          message: `Summary based on your last ${days} days of logged data.`,
        },
        {
          type: "info",
          message:
            typeof avgCalories === "number"
              ? `Average calories (based on ${calorieValues.length} entries): ${Math.round(
                  avgCalories
                )} kcal.`
              : "Calories were not provided for food entries in this time window.",
        },
        ...symptomTimingSummary,
      ],
    });
  } catch (error: any) {
    console.error("AI correlations error:", error.message);

    await logAudit(userId ?? null, "AI_CORRELATION_REQUEST", ip, {
      status: "error",
      message: error?.message,
    });

    return res.status(500).json({
      error: "Failed to generate correlation summary.",
    });
  }
}

module.exports = {
  predictProxy,
  getCorrelations,
};

export {};