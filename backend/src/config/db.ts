import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();
const initUserModel = require("../models/UserModel");
const initAuditLogModel = require("../models/AuditLogModel");
const initFoodLogModel = require("../models/FoodLogModel");
const initMedicationLogModel = require("../models/MedicationLogModel");
const initSymptomLogModel = require("../models/SymptomLogModel");
const initFavouriteModel = require("../models/FavouriteModel");
const initDoctorPatientAssignmentModel = require("../models/DoctorPatientAssignmentModel");
const initDoctorAccountRequestModel = require("../models/DoctorAccountRequestModel");
const initFileRecordModel = require("../models/FileRecordModel");
const initDoctorPatientNoteModel = require("../models/DoctorPatientNoteModel");
const initPatientProfileModel = require("../models/PatientProfileModel");

// Sequelize ORM connects to MySQL database and synchronizes all models
export const sequelize = new Sequelize(
  process.env.DB_NAME || "chronicpal",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    dialect: "mysql",
    logging: false, // disable verbose SQL logs (avoids leaking sensitive data in logs)
  }
);

// Initialize models after defining sequelize
export const User = initUserModel(sequelize);
export const AuditLog = initAuditLogModel(sequelize);
export const FoodLog = initFoodLogModel(sequelize);
export const MedicationLog = initMedicationLogModel(sequelize);
export const SymptomLog = initSymptomLogModel(sequelize); // symptom -> flare-up AI + food/med correlations
export const Favourite = initFavouriteModel(sequelize);
export const DoctorPatientAssignment = initDoctorPatientAssignmentModel(sequelize);
export const DoctorAccountRequest = initDoctorAccountRequestModel(sequelize);
export const FileRecord = initFileRecordModel(sequelize);
export const DoctorPatientNote = initDoctorPatientNoteModel(sequelize);
export const PatientProfile = initPatientProfileModel(sequelize);

// Define relationships
// Audit logs link back to users
AuditLog.belongsTo(User, { foreignKey: "userId", onDelete: "SET NULL" });
User.hasMany(AuditLog, { foreignKey: "userId" });

// Food logs belong to patient users (core chronic illness tracking feature)
FoodLog.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasMany(FoodLog, { foreignKey: "userId" });

// Medication logs belong to patient users
MedicationLog.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasMany(MedicationLog, { foreignKey: "userId" });

// Symptom logs belong to patient users (required for flare-up prediction + symptom correlations)
SymptomLog.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasMany(SymptomLog, { foreignKey: "userId" });

// Favourites belong to patient users
Favourite.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasMany(Favourite, { foreignKey: "userId" });

// Patient profile is one-to-one with a patient user
PatientProfile.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasOne(PatientProfile, { foreignKey: "userId" });

// Doctor/patient access assignments (consent-based: patient requests, doctor accepts)
DoctorPatientAssignment.belongsTo(User, { foreignKey: "doctorId", onDelete: "CASCADE" });
DoctorPatientAssignment.belongsTo(User, { foreignKey: "patientId", onDelete: "CASCADE" });

// Doctor-only notes attached to an active doctor/patient relationship
DoctorPatientNote.belongsTo(User, { as: "doctor", foreignKey: "doctorId", onDelete: "CASCADE" });
User.hasMany(DoctorPatientNote, { as: "doctorNotes", foreignKey: "doctorId" });

DoctorPatientNote.belongsTo(User, { as: "patient", foreignKey: "patientId", onDelete: "CASCADE" });
User.hasMany(DoctorPatientNote, { as: "patientDoctorNotes", foreignKey: "patientId" });

// Secure file metadata belongs to users for ownership, upload tracking, and soft delete auditing
FileRecord.belongsTo(User, { as: "ownerPatient", foreignKey: "ownerPatientId", onDelete: "CASCADE" });
User.hasMany(FileRecord, { as: "ownedFiles", foreignKey: "ownerPatientId" });

FileRecord.belongsTo(User, { as: "uploadedByUser", foreignKey: "uploadedByUserId", onDelete: "CASCADE" });
User.hasMany(FileRecord, { as: "uploadedFiles", foreignKey: "uploadedByUserId" });

FileRecord.belongsTo(User, { as: "deletedByUser", foreignKey: "deletedByUserId", onDelete: "SET NULL" });
User.hasMany(FileRecord, { as: "deletedFiles", foreignKey: "deletedByUserId" });

// Connects to MySQL database and synchronizes all models
export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("MySQL Database connected successfully.");

    // Synchronize models with the database
    await sequelize.sync();
    console.log("All models synchronized successfully.");
  } catch (error: any) {
    console.error("Unable to connect to the database:", error.message);
  }
};

export {};