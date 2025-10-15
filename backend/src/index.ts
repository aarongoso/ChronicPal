// Import core dependencies
const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Import database connection and route files
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const protectedRoutes = require('./routes/protected.routes'); // optional RBAC routes

// Load environment variables
dotenv.config();

// Create an Express application
const app = express();

// Middleware setup
app.use(express.json());      // Parse incoming JSON requests
app.use(cookieParser());      // Parse cookies for refresh token handling

// Mount routes
app.use('/auth', authRoutes);        // Authentication routes
app.use('/protected', protectedRoutes); // Example protected routes (RBAC)

// Health check route
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'ChronicPal backend is running!',
    time: new Date().toISOString(),
  });
});

// Start the server and connect to the database
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await connectDB();
});
