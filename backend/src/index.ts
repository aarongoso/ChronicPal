const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');

dotenv.config();

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'ChronicPal backend is running!',
    time: new Date().toISOString(),
  });
});

const PORT = parseInt(process.env.PORT || '3000', 10);

// Start the server and connect to the database
app.listen(PORT, async () => {
  console.log(` Server running on http://localhost:${PORT}`);
  await connectDB();
});
