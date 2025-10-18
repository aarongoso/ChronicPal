const { sequelize } = require('../config/db');
const AuditLog = require('../models/auditLog.model')(sequelize);

/**
 * Records an audit log entry for security-relevant actions.
 * @param {number|null} userId - ID of the user performing the action.
 * @param {string} action - Short keyword for the event (e.g. 'LOGIN_SUCCESS').
 * @param {string} ipAddress - Request IP address for traceability.
 * @param {object|null} details - contextual info (e.g. role, email).
 */
async function logAudit(userId, action, ipAddress, details = null) {
  try {
    await AuditLog.create({
      userId,
      action,
      ipAddress,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

module.exports = { logAudit };
