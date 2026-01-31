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

  for (const s of symptomRows) {
    const sev = typeof s.severity === "number" ? s.severity : null;
    const loggedAt = s.loggedAt ? new Date(s.loggedAt) : null;
    if (sev === null || !loggedAt || isNaN(loggedAt.getTime())) continue;

    if (sev < highSeverityThreshold) continue;

    // Food window: last 12 hours
    const foodStart = new Date(loggedAt);
    foodStart.setHours(foodStart.getHours() - 12);

    const foodMatch = foodRows.find((f: any) => {
      const t = f.consumedAt ? new Date(f.consumedAt) : null;
      return t && !isNaN(t.getTime()) && t >= foodStart && t <= loggedAt;
    });

    if (foodMatch) highSymptomsAfterFood++;

    // Medication window: last 24 hours
    const medStart = new Date(loggedAt);
    medStart.setHours(medStart.getHours() - 24);

    const medMatch = medRows.find((m: any) => {
      const t = m.takenAt ? new Date(m.takenAt) : null;
      return t && !isNaN(t.getTime()) && t >= medStart && t <= loggedAt;
    });

    if (medMatch) highSymptomsAfterMeds++;
  }

  const summary: any[] = [
    {
      type: "info",
      message:
        "Symptom-based correlations use simple timing windows (food: 12h, medication: 24h) to highlight possible patterns.",
    },
  ];

  if (highSymptomsAfterFood > 0) {
    summary.push({
      type: "warning",
      message: "Higher than usual symptom severity occurred ${highSymptomsAfterFood} time(s) within 12 hours of a logged food entry in this window.",
    });
  } else {
    summary.push({
      type: "info",
      message: "No clear food -> symptom timing pattern detected in this time window.",
    });
  }

  if (highSymptomsAfterMeds > 0) {
    summary.push({
      type: "warning",
      message: "Higher than usual symptom severity occurred ${highSymptomsAfterMeds} time(s) within 24 hours of a logged medication entry in this window.",
    });
  } else {
    summary.push({
      type: "info",
      message: "No clear medication -> symptom timing pattern detected in this time window.",
    });
  }

  summary.push({
    type: "note",
    message:
      "Correlations show associations, not medical cause. These insights are to help self-management and clinician discussions.",
  });

  return summary;
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