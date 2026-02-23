// Import core dependencies
const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

// Security packages
// https://helmetjs.github.io/
// https://expressjs.com/en/resources/middleware/cors.html
// https://www.npmjs.com/package/express-rate-limit
const helmet = require("helmet"); // Adds secure HTTP headers
const cors = require("cors"); // Controls which origins can access the API
const rateLimit = require("express-rate-limit"); // Handles excessive requests

// Import database connection and route files
const { connectDB } = require("./config/db");
const authRoutes = require("./routes/AuthRoutes");
const protectedRoutes = require("./routes/ProtectedRoutes"); // RBAC routes
const adminRoutes = require("./routes/AdminRoutes");
const fileRoutes = require("./routes/FileRoutes"); // Secure file upload routes
const foodRoutes = require("./routes/FoodRoutes");
const medicationRoutes = require("./routes/MedicationRoutes");
const aiRoutes = require("./routes/AiRoutes");
const symptomRoutes = require("./routes/SymptomRoutes");
const favouritesRoutes = require("./routes/FavouritesRoutes");
const frequentItemsRoutes = require("./routes/FrequentItemsRoutes");
const doctorAccessRoutes = require("./routes/DoctorAccessRoutes");
const doctorAiSummaryRoutes = require("./routes/DoctorAiSummaryRoutes");
const personalInsightsRoutes = require("./routes/PersonalInsightsRoutes");
const doctorAccountRequestRoutes = require("./routes/DoctorAccountRequestRoutes");

// Load environment variables
dotenv.config();

// Create an Express application
const app = express();

app.use(helmet()); // Sets security-related HTTP headers to prevent common attacks

// Configure CORS (adjust origins as needed for frontend)
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // Allow sending cookies (for refresh tokens)
  })
);

// Apply rate limiting to all requests
// Higher limits in dev to avoid React strict-mode double fetch causing 429s
const isDev = process.env.NODE_ENV === "development";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  //max: 100, // Limit each IP to 100 requests per window
  max: isDev ? 300 : 100, // dev-only increase, keep prod strict
  message: { error: "Too many requests, please try again later." },
});
app.use(limiter);

// Middleware setup
app.use(express.json()); // Parse incoming JSON requests
app.use(cookieParser()); // Parse cookies for refresh token handling

// Mount routes (authentication, RBAC, admin tools, secure uploads)
app.use("/auth", authRoutes); // Authentication routes
app.use("/protected", protectedRoutes); // Rrotected routes (RBAC)
app.use("/admin", adminRoutes); //Admin routes (Audit log viewer)
app.use("/files", fileRoutes); // secure encrypted file uploads
app.use("/food", foodRoutes); // Food logging routes
app.use("/medications", medicationRoutes); // Medication logging routes
app.use("/ai", aiRoutes); // AI inference proxy routes (backend -> ML service)
app.use("/symptoms", symptomRoutes); // Symptom logging routes (patient timeline -> future AI payload building)
app.use("/favourites", favouritesRoutes); // User favourites (food / medication quick access)
app.use("/frequent-items", frequentItemsRoutes); // Most frequently logged items
app.use("/ai", personalInsightsRoutes); // Patient personal insights
app.use("/doctor-access", doctorAccessRoutes); // Doctor access request + approval workflow
app.use("/doctor/ai-summaries", doctorAiSummaryRoutes); // Clinician facing AI summaries
app.use("/", doctorAccountRequestRoutes); // Doctor onboarding (public + admin + activation)

// Health check route
app.get("/health", (_req: any, res: any) => {
  res.json({
    status: "ok",
    message: "ChronicPal backend is running securely!",
    time: new Date().toISOString(),
  });
});

// Start the server and connect to the database
const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, async () => {
  console.log(`Secure server running on http://localhost:${PORT}`);
  await connectDB();
});
