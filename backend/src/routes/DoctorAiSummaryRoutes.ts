const express = require("express");
const router = express.Router();

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { User, FoodLog, MedicationLog, SymptomLog, DoctorPatientAssignment } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { Op } = require("sequelize");

/**
 * GET /doctor/ai-summaries/:patientId?days=30
 * - doctor/admin only
 * - doctors must have ACTIVE assignment to patient
 * - summary-only response (no raw rows)
 * - does NOT trigger ML inference
 */
router.get(
  "/:patientId",
  authenticateToken,
  authorizeRoles(["doctor", "admin"]),
  async (req: any, res: any) => {
    const doctorId = req.user.id;
    const role = req.user.role;

    try {
      const patientId = parseInt(req.params.patientId, 10);
      if (Number.isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patientId." });
      }

      const daysRaw = req.query.days;
      let days = 30;
      if (daysRaw !== undefined) {
        const parsed = parseInt(daysRaw, 10);
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 365) {
          return res.status(400).json({ error: "Invalid days. Use 1..365." });
        }
        days = parsed;
      }

      // Ensure patient exists and is a patient user
      const patient = await User.findOne({
        where: { id: patientId, role: "patient" },
        attributes: ["id"],
      });

      if (!patient) {
        await logAudit(doctorId, "CLINICIAN_AI_VIEW", req.ip, {
          status: "patient_not_found",
          doctorId,
          patientId,
          days,
        });

        return res.status(404).json({ error: "Patient not found." });
      }

      // Enforce ACTIVE assignment for doctors (consent-based access)
      if (role === "doctor") {
        const active = await DoctorPatientAssignment.findOne({
          where: { doctorId, patientId, status: "ACTIVE" },
          attributes: ["id"],
        });

        if (!active) {
          await logAudit(doctorId, "CLINICIAN_AI_VIEW", req.ip, {
            status: "not_assigned_active",
            doctorId,
            patientId,
            days,
          });

          return res.status(403).json({ error: "Forbidden: no active access to this patient." });
        }
      }

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      // SymptomLogModel uses loggedAt (when symptom occurred)
      const symptomDateField = "loggedAt";

      const [foodCount, medicationCount, symptomCount] = await Promise.all([
        FoodLog.count({ where: { userId: patientId, consumedAt: { [Op.gte]: fromDate } } }),
        MedicationLog.count({ where: { userId: patientId, takenAt: { [Op.gte]: fromDate } } }),
        SymptomLog.count({
          where: { userId: patientId, [symptomDateField]: { [Op.gte]: fromDate } },
        }),
      ]);

      const topFoodsRows = await FoodLog.findAll({
        where: { userId: patientId, consumedAt: { [Op.gte]: fromDate } },
        attributes: ["name", [FoodLog.sequelize.fn("COUNT", FoodLog.sequelize.col("id")), "count"]],
        group: ["name"],
        order: [[FoodLog.sequelize.literal("count"), "DESC"]],
        limit: 5,
      });

      const topFoods = topFoodsRows.map((r: any) => ({
        name: r.name,
        count: parseInt(r.get("count"), 10),
      }));

      const topMedsRows = await MedicationLog.findAll({
        where: { userId: patientId, takenAt: { [Op.gte]: fromDate } },
        attributes: [
          "medicationName",
          [MedicationLog.sequelize.fn("COUNT", MedicationLog.sequelize.col("id")), "count"],
        ],
        group: ["medicationName"],
        order: [[MedicationLog.sequelize.literal("count"), "DESC"]],
        limit: 5,
      });

      const topMedications = topMedsRows.map((r: any) => ({
        name: r.medicationName,
        count: parseInt(r.get("count"), 10),
      }));

      const caloriesRows = await FoodLog.findAll({
        where: { userId: patientId, consumedAt: { [Op.gte]: fromDate } },
        attributes: ["caloriesKcal"],
      });

      const caloriesList = caloriesRows
        .map((r: any) => (typeof r.caloriesKcal === "number" ? r.caloriesKcal : null))
        .filter((v: any) => v !== null);

      const totalCalories = caloriesList.reduce((acc: number, v: number) => acc + v, 0);
      const avgCaloriesPerEntry = caloriesList.length > 0 ? totalCalories / caloriesList.length : null;

      await logAudit(doctorId, "CLINICIAN_AI_VIEW", req.ip, {
        status: "success",
        doctorId,
        patientId,
        days,
        counts: { foodCount, medicationCount, symptomCount },
      });

      return res.json({
        patientId,
        days,
        summary: {
          counts: {
            foodsLogged: foodCount,
            medicationsLogged: medicationCount,
            symptomsLogged: symptomCount,
          },
          topFoods,
          topMedications,
          calorieSummary: {
            entriesWithCalories: caloriesList.length,
            totalCalories: caloriesList.length > 0 ? Math.round(totalCalories) : null,
            avgCaloriesPerEntry: avgCaloriesPerEntry !== null ? Math.round(avgCaloriesPerEntry) : null,
          },
          notes: [
            "Aggregated summaries only (no raw logs by default).",
            "This endpoint does not run live ML inference.",
          ],
        },
      });
    } catch (error: any) {
      await logAudit(req.user?.id ?? null, "CLINICIAN_AI_VIEW", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to fetch doctor AI summary." });
    }
  }
);

module.exports = router;

export {};