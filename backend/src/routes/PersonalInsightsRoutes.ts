const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { FoodLog, MedicationLog, SymptomLog } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { Op } = require("sequelize");

// normalise medication names for ui display
function normaliseName(value: any) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // avoid noisy placeholder values leaking into ui
  if (trimmed.toLowerCase() === "unknown medication") return null;
  // cap length for safety /ui
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

// GET /ai/personal-insights?days=7
// patient only summary stats (no raw rows), always scoped to req.user.id (strict user isolation)
router.get(
  "/personal-insights",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      const daysRaw = req.query.days;
      let days = 7; // default weekly view
      if (daysRaw !== undefined) {
        const parsed = parseInt(daysRaw, 10);
        // bounded range keeps queries predictable and avoids long historical scans
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 365) {
          return res.status(400).json({ error: "Invalid days. Use 1..365." });
        }
        days = parsed;
      }

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      // core counts use COUNT() avoids returning raw rows
      const [foodCount, medicationCount, symptomCount] = await Promise.all([
        FoodLog.count({ where: { userId, consumedAt: { [Op.gte]: fromDate } } }),
        MedicationLog.count({ where: { userId, takenAt: { [Op.gte]: fromDate } } }),
        SymptomLog.count({ where: { userId, loggedAt: { [Op.gte]: fromDate } } }),
      ]);

      // % days with activity is computed using DATE() buckets (summary only, no timestamps)
      const [symptomDayRows, foodDayRows, medDayRows] = await Promise.all([
        SymptomLog.findAll({
          where: { userId, loggedAt: { [Op.gte]: fromDate } },
          attributes: [[SymptomLog.sequelize.fn("DATE", SymptomLog.sequelize.col("loggedAt")), "day"]],
          group: [SymptomLog.sequelize.fn("DATE", SymptomLog.sequelize.col("loggedAt"))],
          raw: true,
        }),
        FoodLog.findAll({
          where: { userId, consumedAt: { [Op.gte]: fromDate } },
          attributes: [[FoodLog.sequelize.fn("DATE", FoodLog.sequelize.col("consumedAt")), "day"]],
          group: [FoodLog.sequelize.fn("DATE", FoodLog.sequelize.col("consumedAt"))],
          raw: true,
        }),
        MedicationLog.findAll({
          where: { userId, takenAt: { [Op.gte]: fromDate } },
          attributes: [[MedicationLog.sequelize.fn("DATE", MedicationLog.sequelize.col("takenAt")), "day"]],
          group: [MedicationLog.sequelize.fn("DATE", MedicationLog.sequelize.col("takenAt"))],
          raw: true,
        }),
      ]);

      const symptomDays = new Set((symptomDayRows || []).map((r: any) => String(r.day)));
      const foodDays = new Set((foodDayRows || []).map((r: any) => String(r.day)));
      const medDays = new Set((medDayRows || []).map((r: any) => String(r.day)));

      const pct = (count: number) => Math.round((count / days) * 100);

      const activity = {
        pctDaysWithSymptoms: pct(symptomDays.size),
        pctDaysWithFood: pct(foodDays.size),
        pctDaysWithMedication: pct(medDays.size),
        daysWithSymptoms: symptomDays.size,
        daysWithFood: foodDays.size,
        daysWithMedication: medDays.size,
      };

      // top items are computed by grouping + COUNT(id) and returning only name + count
      const [topFoodsRows, topMedsRows] = await Promise.all([
        FoodLog.findAll({
          where: { userId, consumedAt: { [Op.gte]: fromDate } },
          attributes: ["name", [FoodLog.sequelize.fn("COUNT", FoodLog.sequelize.col("id")), "count"]],
          group: ["name"],
          order: [[FoodLog.sequelize.literal("count"), "DESC"]],
          limit: 5,
          raw: true,
        }),
        MedicationLog.findAll({
          where: { userId, takenAt: { [Op.gte]: fromDate } },
          attributes: ["medicationName", [MedicationLog.sequelize.fn("COUNT", MedicationLog.sequelize.col("id")), "count"]],
          group: ["medicationName"],
          order: [[MedicationLog.sequelize.literal("count"), "DESC"]],
          limit: 5,
          raw: true,
        }),
      ]);

      const topFoods = (topFoodsRows || []).map((r: any) => ({
        name: r.name,
        count: parseInt(r.count, 10),
      }));

      const topMedications = (topMedsRows || []).map((r: any) => ({
        name: r.medicationName,
        count: parseInt(r.count, 10),
      }));

      // symptom severity stats stay explainable (AVG + distribution + daily trend)
      const [avgSeverityRow, severityDistRows, topSymptomRows, dailyAvgSeverityRows] =
        await Promise.all([
          SymptomLog.findOne({
            where: { userId, loggedAt: { [Op.gte]: fromDate } },
            attributes: [[SymptomLog.sequelize.fn("AVG", SymptomLog.sequelize.col("severity")), "avgSeverity"]],
            raw: true,
          }),
          SymptomLog.findAll({
            where: { userId, loggedAt: { [Op.gte]: fromDate } },
            attributes: ["severity", [SymptomLog.sequelize.fn("COUNT", SymptomLog.sequelize.col("id")), "count"]],
            group: ["severity"],
            order: [["severity", "ASC"]],
            raw: true,
          }),
          SymptomLog.findAll({
            where: { userId, loggedAt: { [Op.gte]: fromDate } },
            attributes: ["symptomName", [SymptomLog.sequelize.fn("COUNT", SymptomLog.sequelize.col("id")), "count"]],
            group: ["symptomName"],
            order: [[SymptomLog.sequelize.literal("count"), "DESC"]],
            limit: 5,
            raw: true,
          }),
          SymptomLog.findAll({
            where: { userId, loggedAt: { [Op.gte]: fromDate } },
            attributes: [
              [SymptomLog.sequelize.fn("DATE", SymptomLog.sequelize.col("loggedAt")), "day"],
              [SymptomLog.sequelize.fn("AVG", SymptomLog.sequelize.col("severity")), "avgSeverity"],
              [SymptomLog.sequelize.fn("COUNT", SymptomLog.sequelize.col("id")), "count"],
            ],
            group: [SymptomLog.sequelize.fn("DATE", SymptomLog.sequelize.col("loggedAt"))],
            order: [[SymptomLog.sequelize.fn("DATE", SymptomLog.sequelize.col("loggedAt")), "ASC"]],
            raw: true,
          }),
        ]);

      const avgSeverity =
        avgSeverityRow && avgSeverityRow.avgSeverity !== null
          ? parseFloat(avgSeverityRow.avgSeverity)
          : null;

      const severityDistribution = (severityDistRows || []).map((r: any) => ({
        severity: typeof r.severity === "number" ? r.severity : parseInt(r.severity, 10),
        count: parseInt(r.count, 10),
      }));

      const topSymptoms = (topSymptomRows || []).map((r: any) => ({
        name: r.symptomName,
        count: parseInt(r.count, 10),
      }));

      const dailyAvgSeverity = (dailyAvgSeverityRows || []).map((r: any) => ({
        day: String(r.day),
        avgSeverity: r.avgSeverity !== null ? Math.round(parseFloat(r.avgSeverity) * 100) / 100 : null,
        count: parseInt(r.count, 10),
      }));

      // calories summary uses only numeric calories (missing values are ignored, not treated as 0)
      const caloriesRows = await FoodLog.findAll({
        where: { userId, consumedAt: { [Op.gte]: fromDate } },
        attributes: ["caloriesKcal"],
        raw: true,
      });

      const caloriesEntries = (caloriesRows || [])
        .map((r: any) => (typeof r.caloriesKcal === "number" ? r.caloriesKcal : null))
        .filter((v: number | null) => v !== null);

      const totalCalories = caloriesEntries.reduce((acc: number, v: number | null) => acc + (v || 0), 0);
      const avgCaloriesPerEntry = caloriesEntries.length > 0 ? totalCalories / caloriesEntries.length : null;

      // medication daily tracker is day bucketed (YYYY-MM-DD), no timestamps returned
      const medicationDailyRows = await MedicationLog.findAll({
        where: { userId, takenAt: { [Op.gte]: fromDate } },
        attributes: [
          [MedicationLog.sequelize.fn("DATE", MedicationLog.sequelize.col("takenAt")), "day"],
          "medicationName",
        ],
        order: [[MedicationLog.sequelize.fn("DATE", MedicationLog.sequelize.col("takenAt")), "ASC"]],
        raw: true,
      });

      const medDailyMap: Record<string, { day: string; count: number; medications: string[] }> = {};
      for (const row of (medicationDailyRows || []) as any[]) {
        const day = String(row.day);
        const cleanName = normaliseName(row.medicationName);

        if (!medDailyMap[day]) {
          medDailyMap[day] = { day, count: 0, medications: [] };
        }

        medDailyMap[day].count += 1;

        if (cleanName && !medDailyMap[day].medications.includes(cleanName)) {
          if (medDailyMap[day].medications.length < 2) {
            medDailyMap[day].medications.push(cleanName);
          }
        }
      }

      const medicationDaily = Object.values(medDailyMap);

      // audit logs are metadata only to preserve privacy (no raw symptoms/foods/med names) 
      await logAudit(userId, "PATIENT_INSIGHTS_VIEW", req.ip, {
        status: "success",
        days,
        counts: { foodCount, medicationCount, symptomCount },
      });

      return res.json({
        days,
        insights: {
          activity,
          counts: {
            foodsLogged: foodCount,
            medicationsLogged: medicationCount,
            symptomsLogged: symptomCount,
          },
          symptoms: {
            avgSeverity: avgSeverity !== null ? Math.round(avgSeverity * 100) / 100 : null,
            severityDistribution,
            topSymptoms,
            dailyAvgSeverity,
          },
          food: { topFoods },
          medications: {
            topMedications,
            medicationDaily,
          },
          calories: {
            entriesWithCalories: caloriesEntries.length,
            totalCalories: caloriesEntries.length > 0 ? Math.round(totalCalories) : null,
            avgCaloriesPerEntry: avgCaloriesPerEntry !== null ? Math.round(avgCaloriesPerEntry) : null,
          },
          notes: [
            "Personal insights computed only from your own logs.",
            "No cohort comparison is used here.",
          ],
        },
      });
    } catch (error) {
      await logAudit(userId ?? null, "PATIENT_INSIGHTS_VIEW", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to fetch personal insights." });
    }
  }
);

module.exports = router;

export {};