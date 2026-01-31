const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const { SymptomLog } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

// backdating but limited (prevents abuse / nonsense data)
function enforceLoggedAtPolicy(rawLoggedAt: any) {
  const now = new Date();

  // Default to now if missing
  const loggedAt = rawLoggedAt ? new Date(String(rawLoggedAt)) : now;

  if (isNaN(loggedAt.getTime())) {
    return { ok: false, error: "loggedAt is invalid." };
  }

  // no future entries (makes correlations unreliable)
  if (loggedAt.getTime() > now.getTime() + 60 * 1000) {
    return { ok: false, error: "loggedAt cannot be in the future." };
  }

  // backdating up to 30 days
  const maxBackDays = 30;
  const earliest = new Date(now);
  earliest.setDate(earliest.getDate() - maxBackDays);

  if (loggedAt.getTime() < earliest.getTime()) {
    return { ok: false, error: `loggedAt cannot be more than ${maxBackDays} days in the past.` };
  }

  return { ok: true, loggedAt };
}

// POST /symptoms/log
// Patient logs symptom severity at a point in time
const logSymptom = async (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "validation_failed", details: errors.array() });
  }

  const userId = req.user?.id;
  const ip = req.ip;

  const { symptomName, severity, loggedAt, notes } = req.body;

  const policy = enforceLoggedAtPolicy(loggedAt);
  if (!policy.ok) {
    return res.status(400).json({ error: policy.error });
  }

  try {
    const created = await SymptomLog.create({
      userId,
      symptomName: String(symptomName).trim(),
      severity: parseInt(String(severity), 10),
      loggedAt: policy.loggedAt,
      notes: notes ? String(notes).trim() : null,
    });

    await logAudit(userId, "LOG_SYMPTOM", ip, {
      logId: created.id,
      symptomName: created.symptomName,
      severity: created.severity,
      loggedAt: created.loggedAt,
    });

    return res.status(201).json({
      message: "Symptom entry logged successfully.",
      symptomLogId: created.id,
    });
  } catch (error: any) {
    console.error("Symptom log error:", error.message);
    return res.status(500).json({ error: "Failed to log symptom entry." });
  }
};

// GET /symptoms/my-logs
// Patient sees their own symptom timeline (for future AI payload building)
const getMySymptomLogs = async (req: any, res: any) => {
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
      where.loggedAt = { [Op.between]: [from, to] };
    } else if (from && !isNaN(from.getTime())) {
      where.loggedAt = { [Op.gte]: from };
    } else if (to && !isNaN(to.getTime())) {
      where.loggedAt = { [Op.lte]: to };
    }

    const rows = await SymptomLog.findAll({
      where,
      order: [["loggedAt", "DESC"]],
      limit,
      offset,
      attributes: ["id", "symptomName", "severity", "loggedAt", "notes", "createdAt"],
    });

    return res.json({
      count: rows.length,
      limit,
      offset,
      items: rows,
    });
  } catch (error: any) {
    console.error("Get symptom logs error:", error.message);
    return res.status(500).json({ error: "Failed to fetch symptom logs." });
  }
};

module.exports = { logSymptom, getMySymptomLogs };

export {};