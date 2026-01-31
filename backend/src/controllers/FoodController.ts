const { nutritionixSearch, nutritionixGetNutrients } = require("../utils/external/NutritionixClient");
const { openFoodFactsSearch, openFoodFactsGetProduct } = require("../utils/external/OpenFoodFactsClient");
const { FoodLog } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { Op } = require("sequelize");

// Maps Nutritionix/OpenFoodFacts responses into a small consistent DTO for the frontend
//kept small to avoid leaking unnecessary external data
const mapFoodResults = (source: string, data: any) => {
  if (source === "NUTRITIONIX") {
    const common = (data?.common || []).slice(0, 10);

    return common.map((item: any) => ({
      source: "NUTRITIONIX",
      externalId: item?.food_name, // using food_name for now, log endpoint re fetches server side
      name: item?.food_name,
      brand: null,
    }));
  }

  // OPENFOODFACTS
  const products = (data?.products || []).slice(0, 25);

  // Only keep results that have a real barcode/code (needed for logging 
  const filtered = products
    .filter((p: any) => p?.code && String(p.code).trim().length > 0)
    .slice(0, 10);

  return filtered.map((p: any) => ({
    source: "OPENFOODFACTS",
    externalId: String(p.code),
    name: p?.product_name || "Unknown product",
    brand: p?.brands || null,
  }));
};

const searchFood = async (req: any, res: any) => {
  const q = req.query.q;

  try {
    // Nutritionix is preferred, but key is not guaranteed (needs approval),
    // if nutritionixSearch returns null it uses fallback
    const nxData = await nutritionixSearch(q);

    if (nxData) {
      const results = mapFoodResults("NUTRITIONIX", nxData);
      return res.json({ sourceUsed: "NUTRITIONIX", results });
    }

    // No Nutritionix keys configured = fallback
    const offData = await openFoodFactsSearch(q);
    const results = mapFoodResults("OPENFOODFACTS", offData);
    return res.json({ sourceUsed: "OPENFOODFACTS", results });
  } catch (err: any) {
    // If Nutritionix is misconfigured or down, try the fallback
    // Keeping errors server side only so no details leaked
    try {
      const offData = await openFoodFactsSearch(q);
      const results = mapFoodResults("OPENFOODFACTS", offData);
      return res.json({ sourceUsed: "OPENFOODFACTS", results });
    } catch (fallbackErr: any) {
      return res.status(502).json({ error: "Food search service unavailable." });
    }
  }
};

//POST /food/log
// Secure logging flow
// Patient only (RBAC done in routes)
// Validated body (express validator)
// Re fetch nutrition details server side (dont trust client macros/calories)
//Save FoodLog row
// Audit log action
const logFood = async (req: any, res: any) => {
  const userId = req.user?.id;
  const ip = req.ip;

  const { source, externalId, consumedAt, notes, riskTags } = req.body;

  try {
    // normalise values defensively (validators should handle it but controller should not trust inputs)
    const sourceNorm = String(source || "").trim().toUpperCase();
    const externalIdNorm = String(externalId || "").trim();
    const riskTagsSafe =
      riskTags && typeof riskTags === "object" && !Array.isArray(riskTags) ? riskTags : null;

    let name = null;
    let brand = null;
    let caloriesKcal = null;
    let macros: any = null;
    let externalRaw: any = null;

    if (sourceNorm === "NUTRITIONIX") {
      // nutritionix unavailable atm
      if (!process.env.NUTRITIONIX_APP_ID || !process.env.NUTRITIONIX_APP_KEY) {
        return res.status(503).json({
          error: "Nutritionix is not configured on this server yet. Please use OpenFoodFacts for now.",
        });
      }

      // natural language nutrients endpoint, externalId here is food_name
      const nxDetails = await nutritionixGetNutrients(String(externalIdNorm));

      const first = nxDetails?.foods?.[0];
      if (!first) {
        return res.status(404).json({ error: "Food item not found." });
      }

      name = first.food_name || String(externalIdNorm);
      caloriesKcal = typeof first.nf_calories === "number" ? first.nf_calories : null;

      macros = {
        proteinG: first.nf_protein ?? null,
        carbsG: first.nf_total_carbohydrate ?? null,
        fatG: first.nf_total_fat ?? null,
        fiberG: first.nf_dietary_fiber ?? null,
        sugarG: first.nf_sugars ?? null,
      };

      // Store limited snapshot
      externalRaw = {
        food_name: first.food_name,
        nf_calories: first.nf_calories,
        nf_protein: first.nf_protein,
        nf_total_carbohydrate: first.nf_total_carbohydrate,
        nf_total_fat: first.nf_total_fat,
        nf_dietary_fiber: first.nf_dietary_fiber,
        nf_sugars: first.nf_sugars,
        serving_qty: first.serving_qty,
        serving_unit: first.serving_unit,
        serving_weight_grams: first.serving_weight_grams,
      };
    } else if (sourceNorm === "OPENFOODFACTS") {
      // Works best when external id is barcode/code
      const offDetails = await openFoodFactsGetProduct(String(externalIdNorm));
      const p = offDetails?.product ? offDetails.product : offDetails;

      if (!p) {
        return res.status(404).json({ error: "Food item not found." });
      }

      // basic required fields
      name = p.product_name || "Unknown product";
      brand = p.brands || null;

      // nutrition fields can be inconsistent, keep what is available
      const nutriments = p.nutriments || {};
      caloriesKcal =
        typeof nutriments["energy-kcal_100g"] === "number" ? nutriments["energy-kcal_100g"] : null;

      macros = {
        proteinG: nutriments.proteins_100g ?? null,
        carbsG: nutriments.carbohydrates_100g ?? null,
        fatG: nutriments.fat_100g ?? null,
        fiberG: nutriments.fiber_100g ?? null,
        sugarG: nutriments.sugars_100g ?? null,
      };

      externalRaw = {
        code: p.code || String(externalIdNorm),
        product_name: p.product_name,
        brands: p.brands,
        nutriments: {
          "energy-kcal_100g": nutriments["energy-kcal_100g"] ?? null,
          proteins_100g: nutriments.proteins_100g ?? null,
          carbohydrates_100g: nutriments.carbohydrates_100g ?? null,
          fat_100g: nutriments.fat_100g ?? null,
          fiber_100g: nutriments.fiber_100g ?? null,
          sugars_100g: nutriments.sugars_100g ?? null,
        },
      };
    } else {
      return res.status(400).json({ error: "Invalid source." });
    }

    const created = await FoodLog.create({
      userId,
      source: sourceNorm,
      externalId: String(externalIdNorm),
      name,
      brand,
      caloriesKcal,
      macros,
      riskTags: riskTagsSafe,
      consumedAt: new Date(consumedAt),
      notes: notes ? String(notes) : null,
      externalRaw,
    });

    await logAudit(userId, "LOG_FOOD", ip, {
      logId: created.id,
      source: sourceNorm,
      externalId: String(externalIdNorm),
    });

    return res.status(201).json({
      message: "Food entry logged successfully.",
      foodLogId: created.id,
    });
  } catch (error: any) {
    console.error("Food log error:", error.message);
    return res.status(500).json({ error: "Failed to log food entry." });
  }
};

// POST /food/manual-log
// Manual logging flow (chronic illness friendly)
// Patient only (RBAC done in routes)
// Validated body (express validator)
// Save FoodLog row with source = MANUAL (nutrition optional)
// Audit log action
const logFoodManual = async (req: any, res: any) => {
  const userId = req.user?.id;
  const ip = req.ip;

  // Added caloriesKcal + macros as optional manual fields
  // helps correlations, Manual needs to persist them
  const { name, consumedAt, notes, riskTags, caloriesKcal, macros } = req.body;

  try {
    const nameNorm = String(name || "").trim();

    // riskTags is already validated, but still keep it defensive
    const riskTagsSafe =
      riskTags && typeof riskTags === "object" && !Array.isArray(riskTags) ? riskTags : null;

    // caloriesKcal optional numeric, store null if missing/blank
    const caloriesNorm =
      typeof caloriesKcal === "number"
        ? caloriesKcal
        : caloriesKcal !== undefined && caloriesKcal !== null && String(caloriesKcal).trim() !== ""
        ? parseFloat(String(caloriesKcal))
        : null;

    // macros: optional object; validator constrains keys/values
    const macrosSafe =
      macros && typeof macros === "object" && !Array.isArray(macros) ? macros : null;

    const created = await FoodLog.create({
      userId,
      source: "MANUAL",
      externalId: null, // manual entry has no trusted external reference
      name: nameNorm,
      brand: null,
      caloriesKcal: Number.isFinite(caloriesNorm) ? caloriesNorm : null,
      macros: macrosSafe,

      riskTags: riskTagsSafe,
      consumedAt: new Date(consumedAt),
      notes: notes ? String(notes) : null,
      externalRaw: null,
    });

    await logAudit(userId, "LOG_FOOD", ip, {
      logId: created.id,
      source: "MANUAL",
    });

    return res.status(201).json({
      message: "Manual food entry logged successfully.",
      foodLogId: created.id,
    });
  } catch (error: any) {
    console.error("Manual food log error:", error.message);
    return res.status(500).json({ error: "Failed to log manual food entry." });
  }
};

// GET /food/my-logs
// Patient only list endpoint
// used for timeline + later flare up insights
const getMyFoodLogs = async (req: any, res: any) => {
  const userId = req.user?.id;

  try {
    // defaults intentionally small for performance
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const offsetRaw = parseInt(String(req.query.offset || "0"), 10);

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    // optional date filters
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where: any = { userId };

    if (from && !isNaN(from.getTime()) && to && !isNaN(to.getTime())) {
      where.consumedAt = { [Op.between]: [from, to] };
    } else if (from && !isNaN(from.getTime())) {
      where.consumedAt = { [Op.gte]: from };
    } else if (to && !isNaN(to.getTime())) {
      where.consumedAt = { [Op.lte]: to };
    }

    const rows = await FoodLog.findAll({
      where,
      order: [["consumedAt", "DESC"]],
      limit,
      offset,
      // only return fields UI actually need
      attributes: [
        "id",
        "source",
        "externalId",
        "name",
        "brand",
        "caloriesKcal",
        "macros",
        "riskTags",
        "consumedAt",
        "notes",
        "createdAt",
      ],
    });

    return res.json({
      count: rows.length,
      limit,
      offset,
      items: rows,
    });
  } catch (error: any) {
    console.error("Get food logs error:", error.message);
    return res.status(500).json({ error: "Failed to fetch food logs." });
  }
};

module.exports = { searchFood, logFood, logFoodManual, getMyFoodLogs };

export {};