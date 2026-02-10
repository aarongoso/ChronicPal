const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { validateSymptomLog, validateSymptomLogQuery } = require("../utils/validators/SymptomValidators");
const { logSymptom, getMySymptomLogs, deleteSymptomLog } = require("../controllers/SymptomController");

// patient only symptom logging
router.post(
  "/log",
  authenticateToken,
  authorizeRoles(["patient"]),
  validateSymptomLog,
  logSymptom
);

// patient only view own symptom logs
router.get(
  "/my-logs",
  authenticateToken,
  authorizeRoles(["patient"]),
  validateSymptomLogQuery,
  getMySymptomLogs
);

// patient only delete own symptom log
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["patient"]),
  deleteSymptomLog
);

module.exports = router;

export {};
