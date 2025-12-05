const express = require("express");
const { Op } = require("sequelize");
const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { AuditLog, User } = require("../config/Db");

const router = express.Router();

// https://sequelize.org/docs/v6/core-concepts/model-querying-basics/
// Provides admin only visibility into system audit log w RBAC enforced

/**
 * GET /admin/audit-logs
 * Returns audit logs (admin only)
 * Supports filtering by ?action=, ?userId=, ?start=, ?end=
 */
router.get(
  "/audit-logs",
  authenticateToken, // valid JWT
  authorizeRoles(["admin"]), // allow only admins
  async (req: any, res: any) => {
    try {
      const { action, userId, start, end } = req.query;

      // Build dynamic WHERE clause
      const whereClause: any = {};

      // Optional action filter (LOGIN, FILE_UPLOAD, REGISTER, etc.)
      if (action) whereClause.action = action;

      // Optional user ID filter
      if (userId) whereClause.userId = userId;

      // Optional date range filters
      if (start || end) {
        whereClause.createdAt = {};
        if (start) whereClause.createdAt[Op.gte] = new Date(start);
        if (end) whereClause.createdAt[Op.lte] = new Date(end);
      }

      // Fetch logs from DB
      const logs = await AuditLog.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            attributes: ["id", "email", "role"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 100, // prevents excessive data exposure
      });

      // Return clean JSON for frontend rendering
      return res.status(200).json({
        message: "Audit logs retrieved successfully.",
        count: logs.length,
        filtersApplied: whereClause,
        logs: logs.map((log: any) => ({
          id: log.id,
          userId: log.userId,
          action: log.action,
          ipAddress: log.ipAddress,
          details: log.details ? JSON.parse(log.details) : null,
          createdAt: log.createdAt,
          user: log.User
            ? {
                id: log.User.id,
                email: log.User.email,
                role: log.User.role,
              }
            : null,
        })),
      });
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      return res
        .status(500)
        .json({ error: "Failed to retrieve audit logs. Please try again." });
    }
  }
);

module.exports = router;

export {};