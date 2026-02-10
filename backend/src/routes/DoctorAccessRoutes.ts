const express = require("express");
const router = express.Router();

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { User, DoctorPatientAssignment } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

/**
 * Minimal validation (kept inline for smallest diff).
 * adapted from common email validation examples on Stack Overflow
 */
const isValidEmail = (value: any) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(trimmed);
};

/**
 * PATIENT: Request doctor access by doctor email
 * POST /doctor-access/request
 * Body: { doctorEmail: string }
 */
router.post(
  "/request",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const patientId = req.user.id;

    try {
      const { doctorEmail } = req.body;

      if (!isValidEmail(doctorEmail)) {
        return res.status(400).json({ error: "Invalid doctorEmail." });
      }

      // Lookup doctor account by email
      const doctor = await User.findOne({
        where: { email: doctorEmail.trim(), role: "doctor" },
        attributes: ["id"],
      });

      if (!doctor) {
        await logAudit(patientId, "DOCTOR_ACCESS_REQUEST", req.ip, {
          status: "doctor_not_found",
        });

        return res.status(404).json({ error: "Doctor not found." });
      }

      // Create or re-open request
      const existing = await DoctorPatientAssignment.findOne({
        where: { doctorId: doctor.id, patientId },
        attributes: ["id", "status"],
      });

      if (existing) {
        if (existing.status === "ACTIVE") {
          await logAudit(patientId, "DOCTOR_ACCESS_REQUEST", req.ip, {
            status: "already_active",
            doctorId: doctor.id,
            assignmentId: existing.id,
          });
          return res.status(409).json({ error: "Doctor access is already active." });
        }

        if (existing.status === "PENDING") {
          await logAudit(patientId, "DOCTOR_ACCESS_REQUEST", req.ip, {
            status: "already_pending",
            doctorId: doctor.id,
            assignmentId: existing.id,
          });
          return res.status(409).json({ error: "Request is already pending." });
        }

        // REVOKED -> allow patient to re-request (set back to PENDING)
        await DoctorPatientAssignment.update(
          { status: "PENDING" },
          { where: { id: existing.id, patientId } }
        );

        await logAudit(patientId, "DOCTOR_ACCESS_REQUEST", req.ip, {
          status: "reopened_pending",
          doctorId: doctor.id,
          assignmentId: existing.id,
        });

        return res.status(200).json({
          message: "Request sent (reopened).",
          assignmentId: existing.id,
          status: "PENDING",
        });
      }

      const created = await DoctorPatientAssignment.create({
        doctorId: doctor.id,
        patientId,
        status: "PENDING",
      });

      await logAudit(patientId, "DOCTOR_ACCESS_REQUEST", req.ip, {
        status: "pending_created",
        doctorId: doctor.id,
        assignmentId: created.id,
      });

      return res.status(201).json({
        message: "Request sent.",
        assignmentId: created.id,
        status: "PENDING",
      });
    } catch (error: any) {
      await logAudit(patientId, "DOCTOR_ACCESS_REQUEST", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to request doctor access." });
    }
  }
);

/**
 * PATIENT: List their doctor access relationships
 * GET /doctor-access
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const patientId = req.user.id;

    try {
      const assignments = await DoctorPatientAssignment.findAll({
        where: { patientId },
        attributes: ["id", "doctorId", "status", "createdAt", "updatedAt"],
        order: [["updatedAt", "DESC"]],
      });

      // Fetch doctor emails for display (minimal info)
      const doctorIds = assignments.map((a: any) => a.doctorId);
      const doctors = await User.findAll({
        where: { id: doctorIds },
        attributes: ["id", "email"],
      });

      const doctorEmailMap: any = {};
      doctors.forEach((d: any) => {
        doctorEmailMap[d.id] = d.email;
      });

      await logAudit(patientId, "DOCTOR_ACCESS_LIST", req.ip, {
        status: "success",
        count: assignments.length,
      });

      const result = assignments.map((a: any) => ({
        id: a.id,
        doctorId: a.doctorId,
        doctorEmail: doctorEmailMap[a.doctorId] || null,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      }));

      return res.json({ assignments: result });
    } catch (error: any) {
      await logAudit(patientId, "DOCTOR_ACCESS_LIST", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to list doctor access." });
    }
  }
);

/**
 * PATIENT: Revoke doctor access
 * DELETE /doctor-access/:id
 * Sets status=REVOKED (keeps record for auditability)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const patientId = req.user.id;

    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id." });
      }

      const assignment = await DoctorPatientAssignment.findOne({
        where: { id, patientId },
        attributes: ["id", "doctorId", "status"],
      });

      if (!assignment) {
        await logAudit(patientId, "DOCTOR_ACCESS_REVOKE", req.ip, {
          status: "not_found",
          assignmentId: id,
        });

        return res.status(404).json({ error: "Assignment not found." });
      }

      await DoctorPatientAssignment.update(
        { status: "REVOKED" },
        { where: { id, patientId } }
      );

      await logAudit(patientId, "DOCTOR_ACCESS_REVOKE", req.ip, {
        status: "success",
        doctorId: assignment.doctorId,
        assignmentId: id,
      });

      return res.json({ message: "Doctor access revoked." });
    } catch (error: any) {
      await logAudit(patientId, "DOCTOR_ACCESS_REVOKE", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to revoke doctor access." });
    }
  }
);

/**
 * DOCTOR: List pending requests for this doctor
 * GET /doctor-access/requests
 * Includes patient email for basic identification in UI
 */
router.get(
  "/requests",
  authenticateToken,
  authorizeRoles(["doctor"]),
  async (req: any, res: any) => {
    const doctorId = req.user.id;

    try {
      const requests = await DoctorPatientAssignment.findAll({
        where: { doctorId, status: "PENDING" },
        attributes: ["id", "patientId", "status", "createdAt"],
        order: [["createdAt", "DESC"]],
      });

      // Fetch patient emails for display purposes only
      const patientIds = requests.map((r: any) => r.patientId);

      const patients = await User.findAll({
        where: { id: patientIds },
        attributes: ["id", "email"],
      });

      const patientEmailMap: any = {};
      patients.forEach((p: any) => {
        patientEmailMap[p.id] = p.email;
      });

      await logAudit(doctorId, "DOCTOR_ACCESS_REQUEST_LIST", req.ip, {
        status: "success",
        count: requests.length,
      });

      const result = requests.map((r: any) => ({
        id: r.id,
        patientId: r.patientId,
        patientEmail: patientEmailMap[r.patientId] || null,
        status: r.status,
        createdAt: r.createdAt,
      }));

      return res.json({ requests: result });
    } catch (error: any) {
      await logAudit(doctorId, "DOCTOR_ACCESS_REQUEST_LIST", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to list requests." });
    }
  }
);

/**
 * DOCTOR: Accept a request
 * POST /doctor-access/requests/:id/accept
 */
router.post(
  "/requests/:id/accept",
  authenticateToken,
  authorizeRoles(["doctor"]),
  async (req: any, res: any) => {
    const doctorId = req.user.id;

    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id." });
      }

      const request = await DoctorPatientAssignment.findOne({
        where: { id, doctorId },
        attributes: ["id", "patientId", "status"],
      });

      if (!request) {
        await logAudit(doctorId, "DOCTOR_ACCESS_ACCEPT", req.ip, {
          status: "not_found",
          assignmentId: id,
        });

        return res.status(404).json({ error: "Request not found." });
      }

      if (request.status !== "PENDING") {
        await logAudit(doctorId, "DOCTOR_ACCESS_ACCEPT", req.ip, {
          status: "invalid_state",
          assignmentId: id,
          currentStatus: request.status,
        });

        return res.status(409).json({ error: "Request is not pending." });
      }

      await DoctorPatientAssignment.update(
        { status: "ACTIVE" },
        { where: { id, doctorId } }
      );

      await logAudit(doctorId, "DOCTOR_ACCESS_ACCEPT", req.ip, {
        status: "success",
        patientId: request.patientId,
        assignmentId: id,
      });

      return res.json({ message: "Request accepted.", status: "ACTIVE" });
    } catch (error: any) {
      await logAudit(doctorId, "DOCTOR_ACCESS_ACCEPT", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to accept request." });
    }
  }
);

/**
 * DOCTOR: Reject a request (sets REVOKED)
 * POST /doctor-access/requests/:id/reject
 */
router.post(
  "/requests/:id/reject",
  authenticateToken,
  authorizeRoles(["doctor"]),
  async (req: any, res: any) => {
    const doctorId = req.user.id;

    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid id." });
      }

      const request = await DoctorPatientAssignment.findOne({
        where: { id, doctorId },
        attributes: ["id", "patientId", "status"],
      });

      if (!request) {
        await logAudit(doctorId, "DOCTOR_ACCESS_REJECT", req.ip, {
          status: "not_found",
          assignmentId: id,
        });

        return res.status(404).json({ error: "Request not found." });
      }

      if (request.status !== "PENDING") {
        await logAudit(doctorId, "DOCTOR_ACCESS_REJECT", req.ip, {
          status: "invalid_state",
          assignmentId: id,
          currentStatus: request.status,
        });

        return res.status(409).json({ error: "Request is not pending." });
      }

      await DoctorPatientAssignment.update(
        { status: "REVOKED" },
        { where: { id, doctorId } }
      );

      await logAudit(doctorId, "DOCTOR_ACCESS_REJECT", req.ip, {
        status: "success",
        patientId: request.patientId,
        assignmentId: id,
      });

      return res.json({ message: "Request rejected.", status: "REVOKED" });
    } catch (error: any) {
      await logAudit(doctorId, "DOCTOR_ACCESS_REJECT", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to reject request." });
    }
  }
);

module.exports = router;

export {};