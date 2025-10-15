const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');

dotenv.config();

// Middleware to parse JSON
const app = express();
app.use(express.json());

app.use('/auth', authRoutes); // mount auth routes
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Start the server and connect to the database
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, async () => {
  console.log(` Server running on http://localhost:${PORT}`);
  await connectDB();
});
