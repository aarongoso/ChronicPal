const { DataTypes } = require('sequelize');

//AuditLog model
//Stores security-relevant events such as user logins, role changes, and data access.
//Provides traceability for accountability and forensic investigation.

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false, // e.g. 'LOGIN_SUCCESS', 'ROLE_CHANGE', etc.
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  });

  return AuditLog;
};
