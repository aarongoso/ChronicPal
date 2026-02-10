const express = require("express");
const router = express.Router();

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { externalApiLimiter } = require("../utils/rateLimiters");
const {
  validateFoodSearch,
  validateFoodLog,
  validateFoodManualLog,
} = require("../utils/validators/FoodValidators");
const {
  searchFood,
  logFood,
  logFoodManual,
  getMyFoodLogs,
  deleteFoodLog,
} = require("../controllers/FoodController");

// Patient only food search
router.get(
  "/search",
  authenticateToken,
  authorizeRoles(["patient"]),
  externalApiLimiter,
  validateFoodSearch,
  searchFood
);

// Patient only log food (server re fetches details then stores + audits)
router.post(
  "/log",
  authenticateToken,
  authorizeRoles(["patient"]),
//  externalApiLimiter,
  validateFoodLog,
  logFood
);

// Patient only manual food log
// homemade meals etc
router.post(
  "/manual-log",
  authenticateToken,
  authorizeRoles(["patient"]),
  validateFoodManualLog,
  logFoodManual
);

// Patient only view own food logs (timeline view + future flare up insights)
router.get(
  "/my-logs",
  authenticateToken,
  authorizeRoles(["patient"]),
  getMyFoodLogs
);

// Patient only delete own food log
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["patient"]),
  deleteFoodLog
);

module.exports = router;

export {};
