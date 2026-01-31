import { DataTypes } from "sequelize";

// SymptomLog model, core data source for AI flare up prediction and correlations
// matches symptom_logs table
module.exports = (sequelize: any) => {
  const SymptomLog = sequelize.define(
    "SymptomLog",
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      symptomName: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },

      // Severity scale intentionally small 1–10
      // important for explainable ML 
      severity: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
      },

      // When the symptom actually occurred
      // This allows backdated entries for better correlations
      loggedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      notes: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: "symptom_logs",
      timestamps: true,
    }
  );

  return SymptomLog;
};

export {};