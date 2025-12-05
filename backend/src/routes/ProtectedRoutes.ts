const express = require("express");
const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");

const router = express.Router();

// reusing RBAC from middleware
/**
 * Protected route for any logged in user
 */
router.get("/user", authenticateToken, (req: any, res: any) => {
  res.json({
    message: `Hello ${req.user.email}, you are logged in as ${req.user.role}.`,
  });
});

/**
 * admin only route
 */
router.get(
  "/admin",
  authenticateToken,
  authorizeRoles(["admin"]),
  (req: any, res: any) => {
    res.json({ message: "Welcome Admin! This route is restricted." });
  }
);

/**
 * Doctor only route
 */
router.get(
  "/doctor",
  authenticateToken,
  authorizeRoles(["doctor"]),
  (req: any, res: any) => {
    res.json({ message: "Welcome Doctor! You have access to this route." });
  }
);

module.exports = router;

export {};