const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Middleware to verify JWT access token
 * If valid, attaches user info (id, email, role) to req.user
 */
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Expect format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access token missing or invalid.' });
  }

  try {
    // Verify token and extract payload
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // Setup tokens are intentionally blocked from normal app routes so they
    // cannot be reused as if they were a full authenticated session
    if (payload?.mfaSetupPending) {
      return res.status(403).json({ error: "MFA setup must be completed first." });
    }
    req.user = payload; // store decoded user data for later
    next();
  } catch (error: any) {
    console.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

const authenticateMfaSetupOrAccessToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing or invalid." });
  }

  try {
    // This variant is only for the MFA setup endpoints, where a short lived
    // setup token is allowed before full access/refresh tokens are issued
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

/**
 * Middleware to enforce role based access control
 * Takes an array of allowed roles (e.g. ['admin', 'doctor'])
 */
const authorizeRoles = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized access.' });
    }

    // Check if users role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient privileges.' });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles, authenticateMfaSetupOrAccessToken };

export {};