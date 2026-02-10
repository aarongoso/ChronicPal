const express = require("express");
const router = express.Router();

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { externalApiLimiter } = require("../utils/rateLimiters");

const {
  validateMedicationSearch,
  validateMedicationLog,
  validateMedicationManualLog,
  validateMedicationMyLogs,
} = require("../utils/validators/MedicationValidators");

const {
  searchMedication,
  logMedication,
  logMedicationManual,
  getMyMedicationLogs,
  deleteMedicationLog,
} = require("../controllers/MedicationController");

// Patient only medication search
// keeps API keys and external requests fully backend
router.get(
  "/search",
  authenticateToken,
  authorizeRoles(["patient"]),
  externalApiLimiter,
  validateMedicationSearch,
  searchMedication
);

// Patient only log medication (server re fetches details then stores + audits)
// defensive design: dont trust client medication fields, only trust externalId + source
router.post(
  "/log",
  authenticateToken,
  authorizeRoles(["patient"]),
  //externalApiLimiter,
  validateMedicationLog,
  logMedication
);

// Patient only manual medication log
// important for supplements, US meds / anything not found in APIs
router.post(
  "/manual-log",
  authenticateToken,
  authorizeRoles(["patient"]),
  validateMedicationManualLog,
  logMedicationManual
);

// Patient only view own medication logs (timeline view + future flare up insights)
router.get(
  "/my-logs",
  authenticateToken,
  authorizeRoles(["patient"]),
  validateMedicationMyLogs,
  getMyMedicationLogs
);

// patient only delete own medication log
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["patient"]),
  deleteMedicationLog
);

module.exports = router;

export {};
