const { DataTypes, Model } = require("sequelize");

// Doctor created notes attached to a patient for doctor view only
// kept separate from patient log notes to avoid mixing ownership + meaning
class DoctorPatientNote extends Model {}

const initDoctorPatientNoteModel = (sequelize: any) => {
  DoctorPatientNote.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        // numeric PK using same pattern previously used
      },

      doctorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        // references the doctor creating the note
        // enforced at route level using req.user.id
      },

      patientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        // links note to a specific patient
        // access controlled via active doctor-patient assignment checks
      },

      body: {
        type: DataTypes.STRING(1000),
        allowNull: false,
        // short text note (kept capped at 1000 chars to avoid abuse / large payloads)
        // intentionally simple just for doctor to keep tabs on patient
      },
    },
    {
      sequelize,
      modelName: "DoctorPatientNote",
      tableName: "doctor_patient_notes",
      indexes: [
        { fields: ["doctorId", "patientId", "createdAt"] },
        // index helps with fast retrieval of notes per doctor-patient pair
        // especially useful for history page ordering by createdAt
      ],
    }
  );

  return DoctorPatientNote;
};

module.exports = initDoctorPatientNoteModel;

export {};