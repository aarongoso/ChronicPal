const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../config/Db"); 
const { logAudit } = require("../utils/AuditLogger");

/**
 * Handles user login and returns access token + role
 * used for the older login flow before we introduced refresh tokens
 */
exports.loginUser = async (req: any, res: any) => {
  try {
    const { email, password } = req.body;

    // sanitisation to prevent malformed input
    if (!email || !password) {
      await logAudit(null, "LOGIN_FAILED", req.ip, { reason: "missing fields" });
      return res.status(400).json({ error: "Invalid login input." });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      // logging failed login but without saying user doesn't exist
      await logAudit(null, "LOGIN_FAILED", req.ip, { attemptedEmail: email });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Check password matches hashed version
    // this password field comes from UserModel beforeCreate hook
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      // OWASP auth cheat sheet
      await logAudit(user.id, "LOGIN_FAILED", req.ip, { attemptedEmail: email });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Create access token (short lived)
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // log successful login – important for audit and forensics
    await logAudit(user.id, "LOGIN_SUCCESS", req.ip, {
      email: user.email,
      role: user.role,
    });

    return res.status(200).json({
      message: "Login successful",
      token,
      role: user.role, // Important for admin detection
    });
  } catch (err: any) {
    console.error("Login error:", err);

    // log the error too for traceability
    await logAudit(null, "LOGIN_ERROR", req.ip, { error: err.message });

    return res.status(500).json({ error: "Login failed." });
  }
};

export {};