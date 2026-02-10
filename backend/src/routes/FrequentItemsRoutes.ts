const express = require("express");
const router = express.Router();

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { FoodLog, MedicationLog, SymptomLog } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { Op } = require("sequelize");

// GET /frequent-items?days=30&type=food|medication|symptom|all
// Patient only returns top N { name, count, type } based on the user's recent logs (used by the "quick log" UI)
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      const daysRaw = req.query.days;
      const typeRaw = (req.query.type || "all").toString().toLowerCase();

      let days = 30;
      if (daysRaw !== undefined) {
        const parsed = parseInt(daysRaw, 10);
        // clamp allowed range to avoid expensive historical scans
        if (Number.isNaN(parsed) || parsed < 1 || parsed > 365) {
          return res.status(400).json({ error: "Invalid days. Use 1..365." });
        }
        days = parsed;
      }

      const allowedTypes = ["food", "medication", "symptom", "all"];
      if (!allowedTypes.includes(typeRaw)) {
        return res.status(400).json({ error: "Invalid type. Use food|medication|symptom|all." });
      }

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const limit = 10; // top-N keeps response + query cost predictable

      // grouping by name and counting rows gives a simple "most frequent" signal without extra tables
      const fetchTopFoods = async () => {
        const rows = await FoodLog.findAll({
          where: {
            userId, // strict user isolation (only ever query the authenticated user's rows)
            consumedAt: { [Op.gte]: fromDate },
          },
          attributes: [
            "name",
            [FoodLog.sequelize.fn("COUNT", FoodLog.sequelize.col("id")), "count"],
          ],
          group: ["name"],
          order: [[FoodLog.sequelize.literal("count"), "DESC"]],
          limit,
        });

        return rows.map((r: any) => ({
          name: r.name,
          count: parseInt(r.get("count"), 10),
          type: "food",
        }));
      };

      const fetchTopMeds = async () => {
        const rows = await MedicationLog.findAll({
          where: {
            userId,
            takenAt: { [Op.gte]: fromDate },
          },
          attributes: [
            "medicationName",
            [MedicationLog.sequelize.fn("COUNT", MedicationLog.sequelize.col("id")), "count"],
          ],
          group: ["medicationName"],
          order: [[MedicationLog.sequelize.literal("count"), "DESC"]],
          limit,
        });

        return rows.map((r: any) => ({
          name: r.medicationName, // mapped to a generic "name" so frontend can render one list component
          count: parseInt(r.get("count"), 10),
          type: "medication",
        }));
      };

      const fetchTopSymptoms = async () => {
        const rows = await SymptomLog.findAll({
          where: {
            userId,
            loggedAt: { [Op.gte]: fromDate },
          },
          attributes: [
            "symptomName",
            [SymptomLog.sequelize.fn("COUNT", SymptomLog.sequelize.col("id")), "count"],
          ],
          group: ["symptomName"],
          order: [[SymptomLog.sequelize.literal("count"), "DESC"]],
          limit,
        });

        return rows.map((r: any) => ({
          name: r.symptomName,
          count: parseInt(r.get("count"), 10),
          type: "symptom",
        }));
      };

      let items: any[] = [];

      if (typeRaw === "food") {
        items = await fetchTopFoods();
      } else if (typeRaw === "medication") {
        items = await fetchTopMeds();
      } else if (typeRaw === "symptom") {
        items = await fetchTopSymptoms();
      } else {
        const [foods, meds, symptoms] = await Promise.all([
          fetchTopFoods(),
          fetchTopMeds(),
          fetchTopSymptoms(),
        ]);
        items = foods
          .concat(meds, symptoms)
          .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
          .slice(0, limit);
      }

      await logAudit(userId, "FREQUENT_ITEMS_VIEW", req.ip, {
        status: "success",
        days,
        type: typeRaw,
        returned: items.length,
      });

      return res.json({ days, type: typeRaw, items });
    } catch (error: any) {
      await logAudit(userId, "FREQUENT_ITEMS_VIEW", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to fetch frequent items." });
    }
  }
);

module.exports = router;

export {};