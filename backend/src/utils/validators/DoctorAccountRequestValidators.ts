const { body, query } = require("express-validator");

const looksLikeHtmlOrScript = (input: string) => {
  const lowered = input.toLowerCase();
  if (lowered.includes("<script") || lowered.includes("</script")) return true;
  return /<[^>]+>/.test(input);
};

const validateDoctorRequest = [
  body("fullName")
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("fullName must be between 2 and 120 characters."),

  body("email")
    .isEmail()
    .normalizeEmail({ gmail_remove_dots: false }) // avoids Gmail specific rewriting, could confuse uniqueness checks
    .isLength({ max: 100 })
    .withMessage("email must be a valid email."),

  body("clinicOrHospital")
    .isString()
    .trim()
    .isLength({ min: 2, max: 160 })
    .withMessage("clinicOrHospital must be between 2 and 160 characters."),

  body("licenseNumber")
    .isString()
    .trim()
    .toUpperCase() // normalise before uniqueness check
    .isLength({ min: 3, max: 40 })
    .matches(/^[A-Z0-9-]+$/) // reduces injection input
    .withMessage("licenseNumber must be alphanumeric (hyphens allowed)."),

  body("notes")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .custom((v: string) => !looksLikeHtmlOrScript(String(v))) // XSS guardrail
    .withMessage("notes contains disallowed content."),
];

const validateActivation = [
  body("token")
    .isString()
    .trim()
    // activation token is randomBytes
    // wide bounds lets us rotate token length later without breaking clients
    .isLength({ min: 40, max: 256 })
    .withMessage("token must be provided."),

  body("password")
    .isString()
    // stronger password policy because this is a privileged doctor account
    .isLength({ min: 12, max: 128 })
    .matches(/[a-z]/)
    .matches(/[A-Z]/)
    .matches(/[0-9]/)
    .matches(/[^A-Za-z0-9]/)
    .withMessage("password must be 12+ chars and include upper, lower, digit, and symbol."),

  body("confirmPassword")
    .isString()
    .custom((value: string, { req }: any) => value === req.body.password)
    .withMessage("confirmPassword must match password."),
];

const validateAdminStatusQuery = [
  query("status")
    .optional()
    .isIn(["PENDING", "APPROVED", "REJECTED"])
    .withMessage("status must be PENDING, APPROVED, or REJECTED."),
];

module.exports = {
  validateDoctorRequest,
  validateActivation,
  validateAdminStatusQuery,
};

export {};