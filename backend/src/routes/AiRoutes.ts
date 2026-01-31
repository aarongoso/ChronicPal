const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { predictValidators } = require("../utils/validators/AiValidators");
const { predictProxy, getCorrelations } = require("../controllers/AiController");

// Patient only AI inference
router.post(
  "/predict",
  authenticateToken,
  authorizeRoles(["patient"]),
  predictValidators,
  predictProxy
);

// Patient correlation summary endpoint
router.get(
  "/correlations",
  authenticateToken,
  authorizeRoles(["patient"]),
  getCorrelations
);

module.exports = router;

export {};