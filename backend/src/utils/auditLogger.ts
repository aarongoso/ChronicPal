const { AuditLog } = require("../config/db");

/**
 * Records an audit log entry for security-relevant actions
 * learned this approach from OWASP logging cheatsheet
 * @param {number|null} userId - ID of the user performing the action
 * @param {string} action - Short keyword for the event (e.g 'LOGIN_SUCCESS')
 * @param {string} ipAddress - IP address for traceability
 * @param {object|null} details - contextual info (e.g role, email)
 */
async function logAudit(
  userId: number | null,
  action: string,
  ipAddress: string,
  details: any = null 
) {
  try {
    await AuditLog.create({
      userId,
      action,
      ipAddress,
      details: details ? JSON.stringify(details) : null,
    });
  } catch (error: any) {
    console.error("Audit log error:", error.message);
  }
}

module.exports = { logAudit };

export {};
