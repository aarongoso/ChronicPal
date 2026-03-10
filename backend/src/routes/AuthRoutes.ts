import express, { Request, Response } from "express";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const { body, validationResult } = require("express-validator");
const { logAudit } = require("../utils/auditLogger");
const { User } = require("../config/db");
const { authLoginLimiter, authMfaLimiter, authMfaSetupLimiter } = require("../utils/RateLimiters");
const { authenticateToken, authenticateMfaSetupOrAccessToken } = require("../middleware/AuthMiddleware");
const { encryptMfaSecret, decryptMfaSecret } = require("../utils/mfaCrypto");
dotenv.config();

const router = express.Router();

const MFA_CHALLENGE_TTL = "5m";
const MFA_SETUP_TTL = "20m";
const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCK_MINUTES = 15;
const FORCED_MFA_ROLES = new Set(["admin", "doctor"]);

const signToken = (payload: any, expiresIn: string) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

const issueAuthTokens = (user: any, res: Response) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = signToken(payload, "15m");
  const refreshToken = signToken(payload, "7d");

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false, // changed at deployment
    sameSite: "strict",
  });

  return accessToken;
};

const isMfaLocked = (user: any) => {
  if (!user.mfaLockUntil) return false;
  return new Date(user.mfaLockUntil).getTime() > Date.now();
};

const resetMfaFailures = async (user: any) => {
  user.mfaFailedAttempts = 0;
  user.mfaLockUntil = null;
  await user.save();
};

const registerMfaFailure = async (user: any) => {
  const failedAttempts = (user.mfaFailedAttempts || 0) + 1;
  user.mfaFailedAttempts = failedAttempts;

  if (failedAttempts >= MFA_MAX_ATTEMPTS) {
    const lockUntil = new Date(Date.now() + MFA_LOCK_MINUTES * 60 * 1000);
    user.mfaLockUntil = lockUntil;
  }

  await user.save();
  return {
    attempts: user.mfaFailedAttempts,
    lockUntil: user.mfaLockUntil,
  };
};

const shouldRequireMfa = (user: any) =>
  user.mfaEnabled || FORCED_MFA_ROLES.has(user.role);

/**
 * POST /auth/register
 * Handles new user registration
 * only patients can self register (doctor/admin restricted)
 * password hashing is done inside UserModel hooks
 */
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }).trim().escape(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const role = "patient"; // avoid privilege escalation

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: "User with this email already exists." });
      }

      // password hashing handled by Sequelize hook
      const newUser = await User.create({ email, password, role });

      await logAudit(newUser.id, "USER_REGISTERED", req.ip, { email, role });

      return res.status(201).json({
        message: "User registered successfully.",
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
      });
    } catch (error) {
      const err = error as Error; // TS fix
      console.error("Registration error:", err.message);

      return res.status(500).json({
        error: "Something went wrong during registration.",
      });
    }
  }
);

/**
 * POST /auth/login
 * Password step for login, might require MFA step up before issuing session tokens
 */
router.post(
  "/login",
  authLoginLimiter,
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().trim().escape(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      if (!email || !password) {
        await logAudit(null, "LOGIN_FAILED", req.ip, { reason: "missing fields" });
        return res.status(400).json({ error: "Email and password are required." });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        await logAudit(null, "LOGIN_FAILED", req.ip, { attemptedEmail: email });
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        await logAudit(user.id, "LOGIN_FAILED", req.ip, { attemptedEmail: email });
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const mfaRequired = shouldRequireMfa(user);

      if (FORCED_MFA_ROLES.has(user.role) && !user.mfaEnabled) {
        // Admins/doctors must finish MFA enrolment before getting any normal session tokens
        //The setup token is scoped to MFA setup only
        const setupToken = signToken(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            type: "mfa_setup",
            mfaSetupPending: true,
          },
          MFA_SETUP_TTL,
        );

        return res.status(200).json({
          message: "MFA setup is required before access.",
          mfaSetupRequired: true,
          setupToken,
        });
      }

      if (mfaRequired) {
        // Step up login: password is correct, but full session is
        // deferred until the secondf actor check passes
        const challengeToken = signToken(
          {
            id: user.id,
            email: user.email,
            role: user.role,
            type: "mfa_challenge",
          },
          MFA_CHALLENGE_TTL,
        );

        return res.status(200).json({
          message: "MFA verification required.",
          mfaRequired: true,
          challengeToken,
        });
      }

      const accessToken = issueAuthTokens(user, res);

      await logAudit(user.id, "LOGIN_SUCCESS", req.ip, {
        email: user.email,
        role: user.role,
      });

      return res.status(200).json({
        message: "Login successful.",
        token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error("Login error:", err.message);
      await logAudit(null, "LOGIN_ERROR", req.ip, { error: err.message });
      return res
        .status(500)
        .json({ error: "Something went wrong during login." });
    }
  },
);

/**
 * GET /auth/me
 * Returns the current authenticated users basic profile state
 */
router.get("/me", authenticateToken, async (req: any, res: Response) => {
  try {
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      role: user.role,
      mfaEnabled: !!user.mfaEnabled,
    });
  } catch (error) {
    const err = error as Error;
    console.error("Auth me error:", err.message);
    return res.status(500).json({ error: "Unable to load current user." });
  }
});

/**
 * POST /auth/mfa/setup/initiate
 * Generates a temporary TOTP secret for setup and returns QR details 
 */
router.post(
  "/mfa/setup/initiate",
  authMfaSetupLimiter,
  authenticateMfaSetupOrAccessToken,
  async (req: any, res: Response) => {
    try {
      const authUser = req.user;
      const user = await User.findByPk(authUser.id);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized." });
      }

      if (authUser.type === "mfa_setup" && !FORCED_MFA_ROLES.has(user.role)) {
        return res.status(403).json({ error: "Invalid setup token." });
      }

      const secret = speakeasy.generateSecret({
        name: `ChronicPal (${user.email})`,
        issuer: "ChronicPal",
      });

      // Store the setup secret in temporary encrypted fields so MFA is not
      // enabled until the user proves they can generate a valid TOTP code
      const encrypted = encryptMfaSecret(secret.base32);
      user.mfaTempSecretCiphertext = encrypted.ciphertext;
      user.mfaTempSecretIv = encrypted.iv;
      user.mfaTempSecretTag = encrypted.tag;
      await user.save();

      const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

      return res.status(200).json({
        otpauthUrl: secret.otpauth_url,
        base32Secret: secret.base32,
        qrCodeDataUrl: qrDataUrl,
      });
    } catch (error) {
      const err = error as Error;
      console.error("MFA setup initiate error:", err.message);
      return res.status(500).json({ error: "Unable to initiate MFA setup." });
    }
  },
);

/**
 * POST /auth/mfa/setup/verify
 * Verifys initial TOTP and enables MFA
 */
router.post(
  "/mfa/setup/verify",
  authMfaSetupLimiter,
  authenticateMfaSetupOrAccessToken,
  [body("code").isString().trim().isLength({ min: 6, max: 8 })],
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    try {
      const { code } = req.body;
      const authUser = req.user;
      const user = await User.findByPk(authUser.id);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized." });
      }

      if (
        !user.mfaTempSecretCiphertext ||
        !user.mfaTempSecretIv ||
        !user.mfaTempSecretTag
      ) {
        return res
          .status(400)
          .json({ error: "MFA setup has not been initiated." });
      }

      if (isMfaLocked(user)) {
        return res.status(423).json({
          error: "MFA is temporarily locked.",
          lockUntil: user.mfaLockUntil,
        });
      }

      const tempSecret = decryptMfaSecret(
        user.mfaTempSecretCiphertext,
        user.mfaTempSecretIv,
        user.mfaTempSecretTag,
      );

      const verified = speakeasy.totp.verify({
        secret: tempSecret,
        encoding: "base32",
        token: code,
        window: 1,
      });

      if (!verified) {
        // Reuse the same counter/lockout path for all MFA failures so setup,
        // verification, and disable flows enforce same brute force policy
        const failState = await registerMfaFailure(user);
        await logAudit(user.id, "MFA_FAILED", req.ip, {
          phase: "setup_verify",
          attempts: failState.attempts,
          locked: !!failState.lockUntil,
        });
        return res.status(401).json({ error: "Invalid verification code." });
      }

      user.mfaEnabled = true;
      user.mfaSecretCiphertext = user.mfaTempSecretCiphertext;
      user.mfaSecretIv = user.mfaTempSecretIv;
      user.mfaSecretTag = user.mfaTempSecretTag;
      user.mfaTempSecretCiphertext = null;
      user.mfaTempSecretIv = null;
      user.mfaTempSecretTag = null;
      user.mfaFailedAttempts = 0;
      user.mfaLockUntil = null;
      await user.save();

      await logAudit(user.id, "MFA_ENABLED", req.ip, { role: user.role });

      return res.status(200).json({ message: "MFA enabled successfully." });
    } catch (error) {
      const err = error as Error;
      console.error("MFA setup verify error:", err.message);
      return res.status(500).json({ error: "Unable to verify MFA setup." });
    }
  },
);

/**
 * POST /auth/mfa/verify
 * Completes step up login and issues access + refresh tokens
 */
router.post(
  "/mfa/verify",
  authMfaLimiter,
  [
    body("challengeToken").isString().notEmpty(),
    body("code").isString().trim().isLength({ min: 6, max: 8 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid verification payload." });
    }

    try {
      const { challengeToken, code } = req.body;

      let challengePayload: any;
      try {
        challengePayload = jwt.verify(challengeToken, process.env.JWT_SECRET);
      } catch (_error) {
        return res
          .status(401)
          .json({ error: "Invalid or expired verification request." });
      }

      if (challengePayload?.type !== "mfa_challenge") {
        return res
          .status(401)
          .json({ error: "Invalid or expired verification request." });
      }

      const user = await User.findByPk(challengePayload.id);
      if (
        !user ||
        !user.mfaEnabled ||
        !user.mfaSecretCiphertext ||
        !user.mfaSecretIv ||
        !user.mfaSecretTag
      ) {
        return res
          .status(401)
          .json({ error: "Invalid or expired verification request." });
      }

      if (isMfaLocked(user)) {
        await logAudit(user.id, "MFA_FAILED", req.ip, {
          phase: "login_verify",
          reason: "locked",
        });
        return res.status(423).json({
          error: "MFA is temporarily locked.",
          lockUntil: user.mfaLockUntil,
        });
      }

      const secret = decryptMfaSecret(
        user.mfaSecretCiphertext,
        user.mfaSecretIv,
        user.mfaSecretTag,
      );

      const verified = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: code,
        window: 1,
      });

      if (!verified) {
        const failState = await registerMfaFailure(user);
        await logAudit(user.id, "MFA_FAILED", req.ip, {
          phase: "login_verify",
          attempts: failState.attempts,
          locked: !!failState.lockUntil,
        });
        return res.status(401).json({ error: "Invalid verification code." });
      }

      await resetMfaFailures(user);
      const accessToken = issueAuthTokens(user, res);

      await logAudit(user.id, "MFA_VERIFIED", req.ip, { role: user.role });
      await logAudit(user.id, "LOGIN_SUCCESS", req.ip, {
        email: user.email,
        role: user.role,
      });

      return res.status(200).json({
        message: "MFA verification successful.",
        token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (error) {
      const err = error as Error;
      console.error("MFA verify error:", err.message);
      return res
        .status(500)
        .json({ error: "Unable to complete MFA verification." });
    }
  },
);

/**
 * POST /auth/mfa/disable
 * Allows patients to disable MFA after verifying a current TOTP code
 */
router.post(
  "/mfa/disable",
  authenticateToken,
  authMfaLimiter,
  [
    body("code").isString().trim().isLength({ min: 6, max: 8 }),
    body("password").isString().trim().isLength({ min: 8 }),
  ],
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: "Invalid verification payload." });
    }

    try {
      const { code, password } = req.body;
      const user = await User.findByPk(req.user.id);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized." });
      }

      if (user.role !== "patient") {
        return res.status(403).json({ error: "Forbidden." });
      }

      if (!user.mfaEnabled) {
        return res.status(400).json({ error: "MFA is already disabled." });
      }

      if (isMfaLocked(user)) {
        return res.status(423).json({
          error: "MFA is temporarily locked.",
          lockUntil: user.mfaLockUntil,
        });
      }

      if (
        !user.mfaSecretCiphertext ||
        !user.mfaSecretIv ||
        !user.mfaSecretTag
      ) {
        return res.status(400).json({ error: "MFA is already disabled." });
      }

      const passwordOk = await bcrypt.compare(password, user.password);

      const secret = decryptMfaSecret(
        user.mfaSecretCiphertext,
        user.mfaSecretIv,
        user.mfaSecretTag,
      );

      const codeOk = speakeasy.totp.verify({
        secret,
        encoding: "base32",
        token: code,
        window: 1,
      });

      if (!passwordOk || !codeOk) {
        // Disabling MFA treated like other sensitive MFA action
        // generic error, shared lockout counter, and audit
        const failState = await registerMfaFailure(user);
        await logAudit(user.id, "MFA_FAILED", req.ip, {
          phase: "disable",
          attempts: failState.attempts,
          locked: !!failState.lockUntil,
        });
        return res.status(401).json({ error: "Invalid verification code." });
      }

      user.mfaEnabled = false;
      user.mfaSecretCiphertext = null;
      user.mfaSecretIv = null;
      user.mfaSecretTag = null;
      // Clear temp setup material so there is no recoverable MFA state left
      // behind after patient opts out
      user.mfaTempSecretCiphertext = null;
      user.mfaTempSecretIv = null;
      user.mfaTempSecretTag = null;
      user.mfaFailedAttempts = 0;
      user.mfaLockUntil = null;
      await user.save();

      await logAudit(user.id, "MFA_DISABLED", req.ip, { role: user.role });

      return res.status(200).json({ message: "MFA disabled successfully." });
    } catch (error) {
      const err = error as Error;
      console.error("MFA disable error:", err.message);
      return res.status(500).json({ error: "Unable to disable MFA." });
    }
  },
);

/**
 * POST /auth/refresh
 * Issues new access token using refresh cookie
 */
router.post("/refresh", (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: "Refresh token missing." });
  }

  try {
    const payload: any = jwt.verify(refreshToken, process.env.JWT_SECRET);

    const newAccessToken = jwt.sign(
      { id: payload.id, email: payload.email, role: payload.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    logAudit(payload.id, "TOKEN_REFRESHED", req.ip, { reason: "rotation" });

    return res.json({ token: newAccessToken });
  } catch (error) {
    const err = error as Error;
    console.error("Refresh token error:", err.message);
    logAudit(null, "TOKEN_REFRESH_FAILED", req.ip, { error: err.message });
    return res.status(403).json({ error: "Invalid or expired refresh token." });
  }
});

/**
 * POST /auth/logout
 * Clears refresh token cookie and logs event
 * based on typical Express cookie clearing:
 * https://expressjs.com/en/api.html#res.clearCookie
 */
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || null;

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    await logAudit(userId, "LOGOUT", req.ip, {});

    return res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    const err = error as Error; // TS fix
    console.error("Logout error:", err.message);

    return res.status(500).json({ error: "Logout failed." });
  }
});

module.exports = router;
export {};
