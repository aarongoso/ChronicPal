const express = require('express');
const { Op } = require('sequelize'); // Sequelize operator for date filters
const { authenticateToken, authorizeRoles } = require('../middleware/auth.middleware');
const { sequelize, AuditLog, User } = require('../config/db');

const router = express.Router();

/**
 * GET /admin/audit-logs
 * Returns audit logs (admin only)
 * Supports filtering by ?action=, ?userId=, ?start=, ?end=
 */
router.get('/audit-logs', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  try {
    const { action, userId, start, end } = req.query;

    // Build dynamic WHERE clause
    const whereClause = {};

    // Filter by action type
    if (action) whereClause.action = action;

    // Filter by user ID
    if (userId) whereClause.userId = userId;

    // Filter by date range
    if (start || end) {
      whereClause.createdAt = {};
      if (start) whereClause.createdAt[Op.gte] = new Date(start);
      if (end) whereClause.createdAt[Op.lte] = new Date(end);
    }

    // Fetch logs with filters applied
    const logs = await AuditLog.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'email', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    // Format logs for clean JSON output
    res.status(200).json({
      message: 'Audit logs retrieved successfully.',
      count: logs.length,
      filtersApplied: whereClause,
      logs: logs.map((log) => ({
        id: log.id,
        userId: log.userId,
        action: log.action,
        ipAddress: log.ipAddress,
        details: log.details ? JSON.parse(log.details) : null,
        createdAt: log.createdAt,
        user: log.User
          ? { id: log.User.id, email: log.User.email, role: log.User.role }
          : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
});

module.exports = router;
