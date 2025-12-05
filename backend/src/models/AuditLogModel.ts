const { DataTypes, Model } = require("sequelize");

// Stores security relevant events such as user logins, role changes, file uploads
// provides traceability for accountability and forensic investigation
const initAuditLogModel = (sequelize: any) => {
  class AuditLog extends Model {}

  AuditLog.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true, // null for system events or failed logins
      },

      action: {
        type: DataTypes.STRING,
        allowNull: false, // e.g LOGIN_SUCCESS, FILE_UPLOAD, REGISTER
      },

      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "AuditLog",
      tableName: "audit_logs",
      timestamps: true,
    }
  );

  return AuditLog;
};

module.exports = initAuditLogModel;

export {};