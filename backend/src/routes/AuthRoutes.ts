import express, { Request, Response } from "express";
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { body, validationResult } = require("express-validator");
const { logAudit } = require("../utils/AuditLogger");
const { User } = require("../config/Db");
dotenv.config();

const router = express.Router();

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
 * Authenticates user and issues access + refresh tokens
 * JWT login example from https://github.com/auth0/node-jsonwebtoken
 */
router.post(
  "/login",
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

      const payload = { id: user.id, email: user.email, role: user.role };

      // short lived access token
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });

      // long lived refresh token
      const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false, // changed at deployment
        sameSite: "strict",
      });

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
      const err = error as Error; // TS fix
      console.error("Login error:", err.message);

      await logAudit(null, "LOGIN_ERROR", req.ip, { error: err.message });

      return res.status(500).json({
        error: "Something went wrong during login.",
      });
    }
  }
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
      { expiresIn: "15m" }
    );

    logAudit(payload.id, "TOKEN_REFRESHED", req.ip, { reason: "rotation" });

    return res.json({ token: newAccessToken });
  } catch (error) {
    const err = error as Error; // TS fix
    console.error("Refresh token error:", err.message);

    logAudit(null, "TOKEN_REFRESH_FAILED", req.ip, { error: err.message });

    return res.status(403).json({
      error: "Invalid or expired refresh token.",
    });
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
