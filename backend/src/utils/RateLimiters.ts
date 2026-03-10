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

const authLoginLimiter = rateLimit({
  // Password endpoints tighter than general API traffic because they
  // are the first target for exploits
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const authMfaLimiter = rateLimit({
  // MFA endpoints keep a separate IP based cap on top of the per user lockout
  // repeated code guessing is constrained even before account lock engages
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many MFA attempts. Please try again later." },
});

const authMfaSetupLimiter = rateLimit({
  // Setup  rate limited to reduce abuse of QR/secret generation
  // and repeated first code verification attempts
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many MFA setup attempts. Please try again later." },
});

module.exports = {
  externalApiLimiter,
  authLoginLimiter,
  authMfaLimiter,
  authMfaSetupLimiter,
};

export {};