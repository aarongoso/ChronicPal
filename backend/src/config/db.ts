const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'chronicpal',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    dialect: 'mysql',
    logging: false, 
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(' MySQL Database connected successfully.');

    // Sync models automatically (for now, good for dev/testing)
    await sequelize.sync();
    console.log(' All models synchronized successfully.');
  } catch (error) {
    console.error(' Unable to connect to the database:', error);
  }
};

module.exports = { sequelize, connectDB };