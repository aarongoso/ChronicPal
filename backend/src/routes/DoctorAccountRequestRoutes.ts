const express = require("express");
const router = express.Router();

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const {
  validateDoctorRequest,
  validateActivation,
  validateAdminStatusQuery,
} = require("../utils/validators/DoctorAccountRequestValidators");

const {
  submitDoctorRequest,
  listDoctorRequests,
  getDoctorRequestById,
  approveDoctorRequest,
  rejectDoctorRequest,
  activateDoctorAccount,
} = require("../controllers/DoctorAccountRequestController");

// Public doctor request (anti enumeration)
router.post("/public/doctor-requests", validateDoctorRequest, submitDoctorRequest);

// Admin review (JWT + RBAC)
router.get(
  "/admin/doctor-requests",
  authenticateToken,
  authorizeRoles(["admin"]),
  validateAdminStatusQuery,
  listDoctorRequests
);

router.get(
  "/admin/doctor-requests/:id",
  authenticateToken,
  authorizeRoles(["admin"]),
  getDoctorRequestById
);

router.post(
  "/admin/doctor-requests/:id/approve",
  authenticateToken,
  authorizeRoles(["admin"]),
  approveDoctorRequest
);

router.post(
  "/admin/doctor-requests/:id/reject",
  authenticateToken,
  authorizeRoles(["admin"]),
  rejectDoctorRequest
);

// Doctor activation
router.post("/doctor-activation", validateActivation, activateDoctorAccount);

module.exports = router;

export {};