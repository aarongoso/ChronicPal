const { DataTypes, Model } = require("sequelize");

class MedicationLog extends Model {}

const initMedicationLogModel = (sequelize: any) => {
  MedicationLog.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      // Patient user who logged the medication entry
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // Manual is supported for supplements / non US meds etc
      source: {
        type: DataTypes.ENUM("OPENFDA", "DAILYMED", "MANUAL"),
        allowNull: false,
      },

      // Manual entries have no trusted external id
      externalId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },

      medicationName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      genericName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      dosageForm: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      strength: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      route: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // When patient took it
      takenAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      doseQty: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },

      doseUnit: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      notes: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      // Sanitised snapshot of external response used during logging
      externalRaw: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "MedicationLog",
      tableName: "medication_logs",
      indexes: [
        { fields: ["userId", "takenAt"] },
        { fields: ["userId", "externalId"] },
      ],
    }
  );

  return MedicationLog;
};

module.exports = initMedicationLogModel;

export {};