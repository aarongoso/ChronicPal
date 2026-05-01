const express = require("express");
const { Op } = require("sequelize");
const { body: validateBody, validationResult } = require("express-validator");

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const {
  DoctorPatientAssignment,
  DoctorPatientNote,
  FoodLog,
  MedicationLog,
  PatientProfile,
  SymptomLog,
  User,
} = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { decryptProfileField } = require("../utils/patientProfileCrypto");

const router = express.Router();

const parsePositiveInt = (value: any) => {
  const parsed = parseInt(String(value), 10);
  // simple guard so ids from params/query are positive integers only
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseBoundedQueryInt = (value: any, defaultValue: number, min: number, max: number) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const parsed = parseInt(String(value), 10);
  // used for query limits like days/limit so they stay inside safe ranges
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
};

const normaliseNoteBody = (value: any) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // notes are intentionally kept simple
  if (!trimmed || trimmed.length > 1000) return null;
  return trimmed;
};

const calculateAge = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return null;

  // DATEONLY is stored without time, UTC midnight to avoid inconsistencies when calculating age from DATEONLY values
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();

  // age calculation, reduces age if birthday has not happened yet this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const decryptProfileText = (profile: any, field: string) => {
  const ciphertext = profile?.[`${field}Ciphertext`];
  const iv = profile?.[`${field}Iv`];
  const tag = profile?.[`${field}Tag`];

  // if any encryption part is missing, treat the value as unavailable instead of crashing
  if (!ciphertext || !iv || !tag) return null;
  return decryptProfileField(ciphertext, iv, tag);
};

const buildProfileSummary = (profile: any) => {
  if (!profile) return null;

  return {
    dateOfBirth: profile.dateOfBirth || null,
    age: calculateAge(profile.dateOfBirth || null),
    heightCm: profile.heightCm === null || profile.heightCm === undefined ? null : Number(profile.heightCm),
    weightKg: profile.weightKg === null || profile.weightKg === undefined ? null : Number(profile.weightKg),
    bloodType: profile.bloodType || null,
    gender: profile.gender || null,
    chronicConditions: decryptProfileText(profile, "chronicConditions"),
    allergies: decryptProfileText(profile, "allergies"),
    medicalHistorySummary: decryptProfileText(profile, "medicalHistorySummary"),
    // summary is read-only and limited to baseline profile data only
    // timeline/history data stays in the other sections below
  };
};

async function ensureActiveAssignment(doctorId: number, patientId: number) {
  return DoctorPatientAssignment.findOne({
    where: {
      doctorId,
      patientId,
      status: "ACTIVE",
    },
    attributes: ["id", "status"],
    // reused helper so doctor access stays consistent across history/profile/notes
  });
}

/**
 * GET /doctor/patients/:patientId/history?days=30&limit=10
 * only doctor can view (not edit) history for activly assigned patients
 */
router.get(
  "/:patientId/history",
  authenticateToken,
  authorizeRoles(["doctor"]),
  async (req: any, res: any) => {
    const doctorId = req.user.id;

    try {
      const patientId = parsePositiveInt(req.params.patientId);
      if (!patientId) {
        await logAudit(doctorId, "DOCTOR_PATIENT_HISTORY_VIEW", req.ip, {
          status: "invalid_patient_id",
          patientId: req.params.patientId,
        });

        return res.status(400).json({ error: "Invalid patientId." });
      }

      const days = parseBoundedQueryInt(req.query.days, 30, 1, 365);
      const limit = parseBoundedQueryInt(req.query.limit, 10, 1, 200);

      if (!days || !limit) {
        await logAudit(doctorId, "DOCTOR_PATIENT_HISTORY_VIEW", req.ip, {
          status: "invalid_query",
          patientId,
          days: req.query.days,
          limit: req.query.limit,
        });

        return res.status(400).json({ error: "Invalid days or limit." });
      }

      const patient = await User.findOne({
        where: { id: patientId, role: "patient" },
        attributes: ["id", "email"],
        // confirms target record is actually a patient account
      });

      if (!patient) {
        await logAudit(doctorId, "DOCTOR_PATIENT_HISTORY_VIEW", req.ip, {
          status: "patient_not_found",
          patientId,
        });

        return res.status(404).json({ error: "Patient not found." });
      }

      const assignment = await ensureActiveAssignment(doctorId, patientId);

      if (!assignment) {
        await logAudit(doctorId, "DOCTOR_PATIENT_HISTORY_VIEW", req.ip, {
          status: "not_assigned_active",
          patientId,
        });

        return res.status(403).json({ error: "Forbidden: no active access to this patient." });
      }

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const [profile, symptoms, foodLogs, medicationLogs, notes] = await Promise.all([
        PatientProfile.findOne({
          where: {
            userId: patientId,
          },
          // profile is fetched only after the ACTIVE assignment check passes
        }),
        SymptomLog.findAndCountAll({
          where: {
            userId: patientId,
            loggedAt: { [Op.gte]: fromDate },
          },
          attributes: ["id", "symptomName", "severity", "loggedAt", "notes", "createdAt"],
          order: [["loggedAt", "DESC"]],
          limit,
        }),
        FoodLog.findAndCountAll({
          where: {
            userId: patientId,
            consumedAt: { [Op.gte]: fromDate },
          },
          attributes: [
            "id",
            "source",
            "name",
            "brand",
            "caloriesKcal",
            "consumedAt",
            "notes",
            "createdAt",
          ],
          order: [["consumedAt", "DESC"]],
          limit,
        }),
        MedicationLog.findAndCountAll({
          where: {
            userId: patientId,
            takenAt: { [Op.gte]: fromDate },
          },
          attributes: [
            "id",
            "source",
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
          order: [["takenAt", "DESC"]],
          limit,
        }),
        DoctorPatientNote.findAndCountAll({
          where: {
            doctorId,
            patientId,
          },
          attributes: ["id", "body", "createdAt"],
          order: [["createdAt", "DESC"]],
          limit,
          // doctor notes are scoped to doctor + patient pair, not shared globally
        }),
      ]);

      await logAudit(doctorId, "DOCTOR_PATIENT_HISTORY_VIEW", req.ip, {
        status: "success",
        patientId,
        assignmentId: assignment.id,
        days,
        limit,
        counts: {
          symptoms: symptoms.count,
          foodLogs: foodLogs.count,
          medicationLogs: medicationLogs.count,
          notes: notes.count,
        },
        profileSummaryIncluded: !!profile,
        // logging metadata only, raw medical/profile values dont go in audit logs
      });

      return res.json({
        patient: {
          id: patient.id,
          email: patient.email,
        },
        assignment: {
          id: assignment.id,
          status: assignment.status,
        },
        profileSummary: buildProfileSummary(profile),
        symptoms: {
          count: symptoms.count,
          items: symptoms.rows,
        },
        foodLogs: {
          count: foodLogs.count,
          items: foodLogs.rows,
        },
        medicationLogs: {
          count: medicationLogs.count,
          items: medicationLogs.rows,
        },
        aiSummary: null,
        notes: {
          count: notes.count,
          items: notes.rows,
        },
      });
    } catch (error: any) {
      await logAudit(doctorId, "DOCTOR_PATIENT_HISTORY_VIEW", req.ip, {
        status: "error",
        patientId: req.params.patientId || null,
      });

      return res.status(500).json({ error: "Failed to fetch patient history." });
    }
  }
);

/**
 * POST /doctor/patients/:patientId/notes
 * Doctor only note creation for actively assigned patient (only doctor can view too)
 */
router.post(
  "/:patientId/notes",
  authenticateToken,
  authorizeRoles(["doctor"]),
  [
    // Validate type and length at the boundary
    validateBody("body").isString().trim().isLength({ min: 1, max: 1000 }).withMessage("Invalid note body."),
  ],
  async (req: any, res: any) => {
    const doctorId = req.user.id;

    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const patientId = parsePositiveInt(req.params.patientId);
      if (!patientId) {
        return res.status(400).json({ error: "Invalid patientId." });
      }

      const body = normaliseNoteBody(req.body?.body);
      if (!body) {
        return res.status(400).json({ error: "Note body is required and must be 1000 characters or fewer." });
      }

      const patient = await User.findOne({
        where: { id: patientId, role: "patient" },
        attributes: ["id"],
      });

      if (!patient) {
        await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_CREATE", req.ip, {
          status: "patient_not_found",
          patientId,
        });

        return res.status(404).json({ error: "Patient not found." });
      }

      const assignment = await ensureActiveAssignment(doctorId, patientId);

      if (!assignment) {
        await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_CREATE", req.ip, {
          status: "not_assigned_active",
          patientId,
        });

        return res.status(403).json({ error: "Forbidden: no active access to this patient." });
      }

      const note = await DoctorPatientNote.create({
        doctorId,
        patientId,
        body,
        // note is always linked to the authenticated doctor, never supplied by client
      });

      await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_CREATE", req.ip, {
        status: "success",
        patientId,
        assignmentId: assignment.id,
        noteId: note.id,
      });

      return res.status(201).json({
        message: "Note added.",
        note: {
          id: note.id,
          body: note.body,
          createdAt: note.createdAt,
        },
      });
    } catch (error: any) {
      await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_CREATE", req.ip, {
        status: "error",
        patientId: req.params.patientId || null,
      });

      return res.status(500).json({ error: "Failed to add note." });
    }
  }
);

/**
 * DELETE /doctor/patients/:patientId/notes/:noteId
 * Doctor note deletion for actively assigned patients
 */
router.delete(
  "/:patientId/notes/:noteId",
  authenticateToken,
  authorizeRoles(["doctor"]),
  async (req: any, res: any) => {
    const doctorId = req.user.id;

    try {
      const patientId = parsePositiveInt(req.params.patientId);
      const noteId = parsePositiveInt(req.params.noteId);

      if (!patientId) {
        return res.status(400).json({ error: "Invalid patientId." });
      }

      if (!noteId) {
        return res.status(400).json({ error: "Invalid noteId." });
      }

      const patient = await User.findOne({
        where: { id: patientId, role: "patient" },
        attributes: ["id"],
      });

      if (!patient) {
        await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_DELETE", req.ip, {
          status: "patient_not_found",
          patientId,
          noteId,
        });

        return res.status(404).json({ error: "Patient not found." });
      }

      const assignment = await ensureActiveAssignment(doctorId, patientId);

      if (!assignment) {
        await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_DELETE", req.ip, {
          status: "not_assigned_active",
          patientId,
          noteId,
        });

        return res.status(403).json({ error: "Forbidden: no active access to this patient." });
      }

      const note = await DoctorPatientNote.findOne({
        where: {
          id: noteId,
          doctorId,
          patientId,
        },
        attributes: ["id"],
      });

      if (!note) {
        await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_DELETE", req.ip, {
          status: "note_not_found",
          patientId,
          noteId,
        });

        return res.status(404).json({ error: "Note not found." });
      }

      await DoctorPatientNote.destroy({
        where: {
          id: noteId,
          doctorId,
          patientId,
        },
      });

      await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_DELETE", req.ip, {
        status: "success",
        patientId,
        assignmentId: assignment.id,
        noteId,
      });

      return res.json({ message: "Note deleted." });
    } catch (error: any) {
      await logAudit(doctorId, "DOCTOR_PATIENT_NOTE_DELETE", req.ip, {
        status: "error",
        patientId: req.params.patientId || null,
        noteId: req.params.noteId || null,
      });

      return res.status(500).json({ error: "Failed to delete note." });
    }
  }
);

module.exports = router;
module.exports.ensureActiveAssignment = ensureActiveAssignment;

export {};
