const { DataTypes, Model } = require("sequelize");

class DoctorPatientAssignment extends Model {}

const initDoctorPatientAssignmentModel = (sequelize: any) => {
  DoctorPatientAssignment.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      doctorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      patientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },

      // Consent-based access lifecycle
      status: {
        type: DataTypes.ENUM("PENDING", "ACTIVE", "REVOKED"),
        allowNull: false,
        defaultValue: "PENDING",
      },
    },
    {
      sequelize,
      modelName: "DoctorPatientAssignment",
      tableName: "doctor_patient_assignments",
      indexes: [
        { unique: true, fields: ["doctorId", "patientId"] }, // prevents duplicates
        { fields: ["doctorId", "status"] },
        { fields: ["patientId", "status"] },
      ],
    }
  );

  return DoctorPatientAssignment;
};

module.exports = initDoctorPatientAssignmentModel;

export {};