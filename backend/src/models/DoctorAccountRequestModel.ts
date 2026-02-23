const { DataTypes, Model } = require("sequelize");

class DoctorAccountRequest extends Model {}

const initDoctorAccountRequestModel = (sequelize: any) => {
  DoctorAccountRequest.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      fullName: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      clinicOrHospital: {
        type: DataTypes.STRING(160),
        allowNull: false,
      },

      licenseNumber: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },

      notes: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      status: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
        allowNull: false,
        defaultValue: "PENDING",
      },

      reviewedBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      doctorUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },

      activationTokenHash: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },

      activationTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "DoctorAccountRequest",
      tableName: "doctor_account_requests",
      indexes: [
        { unique: true, fields: ["email"] },
        { unique: true, fields: ["licenseNumber"] },
        { fields: ["status"] },
        { fields: ["reviewedBy"] },
        { fields: ["doctorUserId"] },
      ],
      timestamps: true,
    }
  );

  return DoctorAccountRequest;
};

module.exports = initDoctorAccountRequestModel;

export {};