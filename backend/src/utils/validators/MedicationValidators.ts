const { query, body, validationResult } = require("express-validator");

// Helper middleware to return validation errors
const handleValidation = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed.",
      details: errors.array().map((e: any) => ({ field: e.param, msg: e.msg })),
    });
  }
  next();
};

const validateMedicationSearch = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("q must be between 2 and 60 characters.")
    .matches(/^[\p{L}\p{N}\s,'\-().]+$/u)
    .withMessage("q contains invalid characters."),
  handleValidation,
];

const validateMedicationLog = [
  body("source")
    .exists()
    .withMessage("Invalid source.")
    .bail()
    .trim()
    .toUpperCase()
    .isIn(["OPENFDA", "DAILYMED"])
    .withMessage("Invalid source."),

  body("externalId")
    .exists()
    .withMessage("externalId is required and must be <= 128 chars.")
    .bail()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage("externalId is required and must be <= 128 chars.")
    .matches(/^[a-zA-Z0-9:_\-\.]+$/)
    .withMessage("externalId contains invalid characters."),

  body("takenAt")
    .exists()
    .withMessage("takenAt must be a valid ISO8601 date/time.")
    .bail()
    .isISO8601()
    .withMessage("takenAt must be a valid ISO8601 date/time."),

  body("doseQty")
    .optional({ nullable: true })
    .isFloat({ min: 0.0, max: 100000 })
    .withMessage("doseQty must be a valid number."),

  body("doseUnit")
    .optional({ nullable: true })
    .customSanitizer((v: any) => (v === null ? null : String(v)))
    .trim()
    .isLength({ max: 50 })
    .withMessage("doseUnit must be <= 50 chars.")
    .matches(/^[\p{L}\p{N}\s\.\-\/]+$/u)
    .withMessage("doseUnit contains invalid characters."),

  body("notes")
    .optional({ nullable: true })
    .customSanitizer((v: any) => (v === null ? null : String(v)))
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must be <= 500 chars."),
  handleValidation,
];

// Manual medication logging validator externalId isnt required
const validateMedicationManualLog = [
  body("medicationName")
    .exists()
    .withMessage("medicationName is required.")
    .bail()
    .customSanitizer((v: any) => (v === null ? "" : String(v)))
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("medicationName must be between 1 and 255 characters.")
    .matches(/^[\p{L}\p{N}\s,'\-().]+$/u)
    .withMessage("medicationName contains invalid characters."),

  body("genericName")
    .optional({ nullable: true })
    // handling null + numbers defensively
    .customSanitizer((v: any) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s.toLowerCase() === "null" || s.length === 0) return null;
      return s;
    })
    .custom((v: any) => v === null || /^[\p{L}\p{N}\s,'\-().\/%+]+$/u.test(v))
    .withMessage("genericName contains invalid characters.")
    .custom((v: any) => v === null || v.length <= 255)
    .withMessage("genericName must be <= 255 chars."),

  body("dosageForm")
    .optional({ nullable: true })
    .customSanitizer((v: any) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s.toLowerCase() === "null" || s.length === 0) return null;
      return s;
    })
    .custom((v: any) => v === null || /^[\p{L}\p{N}\s,'\-().]+$/u.test(v))
    .withMessage("dosageForm contains invalid characters.")
    .custom((v: any) => v === null || v.length <= 255)
    .withMessage("dosageForm must be <= 255 chars."),

  body("strength")
    .optional({ nullable: true })
    .customSanitizer((v: any) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s.toLowerCase() === "null" || s.length === 0) return null;
      return s;
    })
    .custom((v: any) => v === null || /^[\p{L}\p{N}\s\.\-\/(),%+]+$/u.test(v))
    .withMessage("strength contains invalid characters.")
    .custom((v: any) => v === null || v.length <= 255)
    .withMessage("strength must be <= 255 chars."),

  body("route")
    .optional({ nullable: true })
    .customSanitizer((v: any) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s.toLowerCase() === "null" || s.length === 0) return null;
      return s;
    })
    .custom((v: any) => v === null || /^[\p{L}\p{N}\s,'\-().]+$/u.test(v))
    .withMessage("route contains invalid characters.")
    .custom((v: any) => v === null || v.length <= 100)
    .withMessage("route must be <= 100 chars."),

  body("takenAt")
    .exists()
    .withMessage("takenAt must be a valid ISO8601 date/time.")
    .bail()
    .isISO8601()
    .withMessage("takenAt must be a valid ISO8601 date/time."),

  body("doseQty")
    .optional({ nullable: true })
    .isFloat({ min: 0.0, max: 100000 })
    .withMessage("doseQty must be a valid number."),

  body("doseUnit")
    .optional({ nullable: true })
    .customSanitizer((v: any) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s.toLowerCase() === "null" || s.length === 0) return null;
      return s;
    })
    .custom((v: any) => v === null || /^[\p{L}\p{N}\s\.\-\/]+$/u.test(v))
    .withMessage("doseUnit contains invalid characters.")
    .custom((v: any) => v === null || v.length <= 50)
    .withMessage("doseUnit must be <= 50 chars."),

  body("notes")
    .optional({ nullable: true })
    .customSanitizer((v: any) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim();
      if (s.toLowerCase() === "null" || s.length === 0) return null;
      return s;
    })
    .custom((v: any) => v === null || v.length <= 500)
    .withMessage("notes must be <= 500 chars."),
  handleValidation,
];

const validateMedicationMyLogs = [
  query("from")
    .optional()
    .isISO8601()
    .withMessage("from must be a valid ISO8601 date/time."),
  query("to")
    .optional()
    .isISO8601()
    .withMessage("to must be a valid ISO8601 date/time."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage("limit must be between 1 and 200."),
  query("offset")
    .optional()
    .isInt({ min: 0, max: 1000000 })
    .withMessage("offset must be a valid non-negative integer."),
  handleValidation,
];

module.exports = {
  validateMedicationSearch,
  validateMedicationLog,
  validateMedicationManualLog,
  validateMedicationMyLogs,
};

export {};