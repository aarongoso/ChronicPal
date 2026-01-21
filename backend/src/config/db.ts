import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();
const initUserModel = require("../models/UserModel");
const initAuditLogModel = require("../models/AuditLogModel");
const initFoodLogModel = require("../models/FoodLogModel");
const initMedicationLogModel = require("../models/MedicationLogModel");

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