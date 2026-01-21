const { MedicationLog } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { Op } = require("sequelize");

// External API clients serverside only, no keys exposed to browser
// OpenFDA use set_id lookups
const { openFdaSearch, openFdaGetBySetId } = require("../utils/external/OpenFdaClient");
const { dailyMedSearch, dailyMedGetDetails } = require("../utils/external/DailyMedClient");

// Maps OpenFDA/DailyMed responses into a small consistent DTO for the frontend
const mapMedicationResults = (source: string, data: any) => {
  if (source === "OPENFDA") {
    const results = (data?.results || []).slice(0, 10);

    // OpenFDA fields vary by endpoint
    return results
      .map((r: any) => {
        const openfda = r?.openfda || {};

        const brandName =
          (Array.isArray(openfda.brand_name) && openfda.brand_name[0]) ||
          (Array.isArray(openfda.brand_name_base) && openfda.brand_name_base[0]) ||
          null;

        const genericName =
          (Array.isArray(openfda.generic_name) && openfda.generic_name[0]) || null;

        const dosageForm =
          (Array.isArray(openfda.dosage_form) && openfda.dosage_form[0]) || null;

        const route =
          (Array.isArray(openfda.route) && openfda.route[0]) || null;

        // stable identifier SPL set id common in drug label responses
        const externalId =
          r?.set_id ||
          (Array.isArray(openfda.spl_set_id) && openfda.spl_set_id[0]) ||
          r?.id ||
          null;

        return {
          source: "OPENFDA",
          externalId: externalId ? String(externalId) : null,
          medicationName: brandName || genericName || "Unknown medication",
          genericName: genericName,
          dosageForm: dosageForm,
          strength: null,
          route: route,
        };
      })
      .filter((x: any) => x.externalId); // only return results that can be logged safely
  }

  // DAILYMED (fallback)
  const results = (data?.data || data?.results || []).slice(0, 10);

  return results
    .map((r: any) => {
      // DailyMed often provides setid/splSetId type identifiers depending on endpoint
      const externalId = r?.setid || r?.setId || r?.spl_set_id || r?.id || null;

      const medicationName = r?.title || r?.drug_name || r?.name || "Unknown medication";

      return {
        source: "DAILYMED",
        externalId: externalId ? String(externalId) : null,
        medicationName,
        genericName: r?.generic_name || null,
        dosageForm: r?.dosage_form || null,
        strength: r?.strength || null,
        route: r?.route || null,
      };
    })
    .filter((x: any) => x.externalId);
};

const searchMedication = async (req: any, res: any) => {
  const q = req.query.q;

  try {
    // OpenFDA preferred
    const openFdaData = await openFdaSearch(q);
    //const openFdaData = null; // force fallback for Postman testing
    if (openFdaData) {
      const results = mapMedicationResults("OPENFDA", openFdaData);
      return res.json({ sourceUsed: "OPENFDA", results });
    }

    const dmData = await dailyMedSearch(q);
    const results = mapMedicationResults("DAILYMED", dmData);
    return res.json({ sourceUsed: "DAILYMED", results });
  } catch (err: any) {
    // If OpenFDA is down, try fallback
    // Keeping errors server side only so no detaols leaked
    try {
      const dmData = await dailyMedSearch(q);
      const results = mapMedicationResults("DAILYMED", dmData);
      return res.json({ sourceUsed: "DAILYMED", results });
    } catch (fallbackErr: any) {
      return res.status(502).json({ error: "Medication search service unavailable." });
    }
  }
};

// POST /medications/log
// Secure logging flow
// Patient only (RBAC done in routes)
// Validated body (express validator)
// Re fetch medication details server side (dont trust client medication fields)
// Save MedicationLog row
// Audit log action
const logMedication = async (req: any, res: any) => {
  const userId = req.user?.id;
  const ip = req.ip;

  const { source, externalId, takenAt, doseQty, doseUnit, notes } = req.body;

  try {
    // normalise values defensively
    const sourceNorm = String(source || "").trim().toUpperCase();
    const externalIdNorm = String(externalId || "").trim();

    let medicationName = null;
    let genericName = null;
    let dosageForm = null;
    let strength = null;
    let route = null;
    let externalRaw: any = null;

    if (sourceNorm === "OPENFDA") {
      // Re fetch by set_id
      const details = await openFdaGetBySetId(externalIdNorm);
      const r = details?.results?.[0];
      if (!r) {
        return res.status(404).json({ error: "Medication item not found." });
      }

      const openfda = r?.openfda || {};
      medicationName =
        (Array.isArray(openfda.brand_name) && openfda.brand_name[0]) ||
        (Array.isArray(openfda.brand_name_base) && openfda.brand_name_base[0]) ||
        (Array.isArray(openfda.generic_name) && openfda.generic_name[0]) ||
        "Unknown medication";

      genericName =
        (Array.isArray(openfda.generic_name) && openfda.generic_name[0]) || null;

      dosageForm =
        (Array.isArray(openfda.dosage_form) && openfda.dosage_form[0]) || null;

      route = (Array.isArray(openfda.route) && openfda.route[0]) || null;

      // Strength is messy in OpenFDA and sometimes in "spl_product_data_elements"
      // so now store null
      strength = null;

      // Store a limited snapshot
      externalRaw = {
        set_id: r?.set_id || null,
        id: r?.id || null,
        openfda: {
          brand_name: openfda.brand_name || null,
          generic_name: openfda.generic_name || null,
          dosage_form: openfda.dosage_form || null,
          route: openfda.route || null,
        },
      };
    } else if (sourceNorm === "DAILYMED") {
      // DailyMed sometimes responds with 415
      let details: any = null;

      try {
        details = await dailyMedGetDetails(externalIdNorm);
      } catch (apiErr: any) {
        const status = apiErr?.response?.status;

        if (status === 404) {
          return res.status(404).json({ error: "Medication item not found." });
        }

        return res.status(502).json({ error: "DailyMed service unavailable." });
      }

      const r = details?.data || details?.results?.[0] || details;
      if (!r) {
        return res.status(404).json({ error: "Medication item not found." });
      }

      medicationName = r?.title || r?.drug_name || r?.name || "Unknown medication";
      genericName = r?.generic_name || null;
      dosageForm = r?.dosage_form || null;
      strength = r?.strength || null;
      route = r?.route || null;

      externalRaw = {
        setid: r?.setid || r?.setId || externalIdNorm || null,
        title: r?.title || null,
        generic_name: r?.generic_name || null,
        dosage_form: r?.dosage_form || null,
        strength: r?.strength || null,
        route: r?.route || null,
      };
    } else {
      return res.status(400).json({ error: "Invalid source." });
    }

    const created = await MedicationLog.create({
      userId,
      source: sourceNorm,
      externalId: externalIdNorm,
      medicationName,
      genericName,
      dosageForm,
      strength,
      route,
      takenAt: new Date(takenAt),
      doseQty:
        typeof doseQty === "number"
          ? doseQty
          : doseQty !== undefined && doseQty !== null && String(doseQty).trim() !== ""
          ? parseFloat(String(doseQty))
          : null,
      doseUnit: doseUnit ? String(doseUnit) : null,
      notes: notes ? String(notes) : null,
      externalRaw,
    });

    await logAudit(userId, "LOG_MEDICATION", ip, {
      logId: created.id,
      source: sourceNorm,
      externalId: externalIdNorm,
    });

    return res.status(201).json({
      message: "Medication entry logged successfully.",
      medicationLogId: created.id,
    });
  } catch (error: any) {
    console.error("Medication log error:", error.message);
    return res.status(500).json({ error: "Failed to log medication entry." });
  }
};

// POST /medications/manual-log
// Manual logging flow
// Patient only (RBAC done in routes)
// Validated body (express validator)
// Save MedicationLog row with source = MANUAL (no externalId)
// Audit log action
const logMedicationManual = async (req: any, res: any) => {
  const userId = req.user?.id;
  const ip = req.ip;

  const { medicationName, genericName, dosageForm, strength, route, takenAt, doseQty, doseUnit, notes } = req.body;

  try {
    const medicationNameNorm = String(medicationName || "").trim();

    const created = await MedicationLog.create({
      userId,
      source: "MANUAL",
      externalId: null,
      medicationName: medicationNameNorm,
      genericName: genericName ? String(genericName).trim() : null,
      dosageForm: dosageForm ? String(dosageForm).trim() : null,
      strength: strength ? String(strength).trim() : null,
      route: route ? String(route).trim() : null,
      takenAt: new Date(takenAt),
      doseQty:
        typeof doseQty === "number"
          ? doseQty
          : doseQty !== undefined && doseQty !== null && String(doseQty).trim() !== ""
          ? parseFloat(String(doseQty))
          : null,
      doseUnit: doseUnit ? String(doseUnit).trim() : null,
      notes: notes ? String(notes) : null,
      externalRaw: null,
    });

    await logAudit(userId, "LOG_MEDICATION", ip, {
      logId: created.id,
      source: "MANUAL",
    });

    return res.status(201).json({
      message: "Manual medication entry logged successfully.",
      medicationLogId: created.id,
    });
  } catch (error: any) {
    console.error("Manual medication log error:", error.message);
    return res.status(500).json({ error: "Failed to log manual medication entry." });
  }
};

// GET /medications/my-logs
// Patient only list endpoint for timeline + later flare up insights
const getMyMedicationLogs = async (req: any, res: any) => {
  const userId = req.user?.id;

  try {
    const limitRaw = parseInt(String(req.query.limit || "50"), 10);
    const offsetRaw = parseInt(String(req.query.offset || "0"), 10);

    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where: any = { userId };

    if (from && !isNaN(from.getTime()) && to && !isNaN(to.getTime())) {
      where.takenAt = { [Op.between]: [from, to] };
    } else if (from && !isNaN(from.getTime())) {
      where.takenAt = { [Op.gte]: from };
    } else if (to && !isNaN(to.getTime())) {
      where.takenAt = { [Op.lte]: to };
    }

    const rows = await MedicationLog.findAll({
      where,
      order: [["takenAt", "DESC"]],
      limit,
      offset,
      // only return fields the UI actually needs
      attributes: [
        "id",
        "source",
        "externalId",
        "medicationName",
        "genericName",
        "dosageForm",
        "strength",
        "route",
        "takenAt",
        "doseQty",
        "doseUnit",
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
    console.error("Get medication logs error:", error.message);
    return res.status(500).json({ error: "Failed to fetch medication logs." });
  }
};

module.exports = {
  searchMedication,
  logMedication,
  logMedicationManual,
  getMyMedicationLogs,
};

export {};