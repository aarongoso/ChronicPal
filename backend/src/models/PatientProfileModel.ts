const { DataTypes, Model } = require("sequelize");

// Stores baseline patient health information
// kept separate from User model to follow separation of concerns (auth vs medical data)
// Encrypted sensitive free text medical data because it contains detailed health information,
// while structured lower risk fields are stored in plaintext to keep the system simple and usable
class PatientProfile extends Model {}

const initPatientProfileModel = (sequelize: any) => {
  PatientProfile.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },

      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        // one to one relationship with user, each patient can only have a single profile
      },

      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        // stored as plain date to allow easy age calculation in backend
        // not encrypted to avoid unnecessary complexity for simple derived values
      },

      heightCm: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        // numeric height field, low sensitivity no need for encryption
      },

      weightKg: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        // numeric weight field, used for basic health context only so no encryption
      },

      bloodType: {
        type: DataTypes.ENUM(
          "A_POS",
          "A_NEG",
          "B_POS",
          "B_NEG",
          "O_POS",
          "O_NEG",
          "AB_POS",
          "AB_NEG"
        ),
        allowNull: true,
        // fixed enum so valid medical values only like realistic clinical systems (HSE recordsc and such)
      },

      gender: {
        type: DataTypes.STRING(20),
        allowNull: true,
        // simple as short string (frontend controls allowed values)
      },

      // ------- ENCRYPTED MEDICAL FIELDS ---------------
      // same AES-256-GCM pattern used previusly in the project
      // learned this from 
      chronicConditionsCiphertext: {
        type: DataTypes.TEXT,
        allowNull: true,
        // encrypted conditions text field (most sensitive)
      },

      chronicConditionsIv: {
        type: DataTypes.STRING,
        allowNull: true,
        // initialization vector for AES-GCM
      },

      chronicConditionsTag: {
        type: DataTypes.STRING,
        allowNull: true,
        // authentication tag for integrity verification
      },

      allergiesCiphertext: {
        type: DataTypes.TEXT,
        allowNull: true,
        // encrypted (important clinical safety data)
      },

      allergiesIv: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      allergiesTag: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      medicalHistorySummaryCiphertext: {
        type: DataTypes.TEXT,
        allowNull: true,
        // encrypted summary of past conditions/treatments (sensitive)
      },

      medicalHistorySummaryIv: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      medicalHistorySummaryTag: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "PatientProfile",
      tableName: "patient_profiles",
      indexes: [
        { unique: true, fields: ["userId"] },
        // enforces one to one relationship at DB level
      ],
    }
  );

  return PatientProfile;
};

module.exports = initPatientProfileModel;

export {};