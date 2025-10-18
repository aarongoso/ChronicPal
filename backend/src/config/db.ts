const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const initUserModel = require('../models/user.model');
const initAuditLogModel = require('../models/auditLog.model'); // renamed for clarity

dotenv.config();

// Create Sequelize instance first
const sequelize = new Sequelize(
  process.env.DB_NAME || 'chronicpal',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    dialect: 'mysql',
    logging: false, // disable verbose SQL logs
  }
);

// Initialize models after defining sequelize
const User = initUserModel(sequelize);
const AuditLog = initAuditLogModel(sequelize);
// Define relationships
AuditLog.belongsTo(User, { foreignKey: 'userId', onDelete: 'SET NULL' });
User.hasMany(AuditLog, { foreignKey: 'userId' });


//Connects to MySQL database and synchronizes all models

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Database connected successfully.');

    // Synchronize models with the database
    await sequelize.sync();
    console.log('All models synchronized successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

module.exports = { sequelize, connectDB, User, AuditLog };
