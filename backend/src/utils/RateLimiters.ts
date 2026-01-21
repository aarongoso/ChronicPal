const rateLimit = require("express-rate-limit");

// Separate limiter for external API proxy routes
// from express rate limit example
const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30, // 30 requests/minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

module.exports = { externalApiLimiter };

export {};