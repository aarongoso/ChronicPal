const express = require('express');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const cookieParser = require('cookie-parser'); // allows reading cookies from requests
const app = express();

dotenv.config();

app.use(express.json()); // Middleware to parse JSON
app.use(cookieParser()); // middleware to parse cookies
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
