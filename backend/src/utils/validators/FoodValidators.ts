const { query, body, validationResult } = require("express-validator");

// Helper middleware to return validation errors 
// adapted from express validator examples
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

const validateFoodSearch = [
  query("q")
    .trim()
    .isLength({ min: 2, max: 60 })
    .withMessage("q must be between 2 and 60 characters.")
    // allow unicode letters/numbers so users can search foods in different languages (still block odd symbols)
    .matches(/^[\p{L}\p{N}\s,'\-().]+$/u)
    .withMessage("q contains invalid characters."),
  handleValidation,
];

const validateRiskTags = body("riskTags")
  .optional()
  .custom((value: any) => {
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("riskTags must be an object.");
    }

    // allowed structured trigger flags
    const allowedKeys = [
      "containsDairy",
      "containsGluten",
      "highFibre",
      "spicy",
      "highFat",
      "caffeine",
      "alcohol",
      "highSugar",
      "highSodium",
      "highIron",
    ];

    for (const key of Object.keys(value)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Invalid riskTags field: ${key}`);
      }

      const v = value[key];
      if (!(v === true || v === false || v === null)) {
        throw new Error(`riskTags.${key} must be true, false, or null`);
      }
    }

    return true;
  });

// manual calories
const validateCaloriesKcal = body("caloriesKcal")
  .optional()
  .custom((value: any) => {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (!Number.isFinite(n)) throw new Error("caloriesKcal must be a number.");
    if (n < 0 || n > 10000) throw new Error("caloriesKcal out of allowed range.");
    return true;
  });

// manual macros
// values can be numbers or null
const validateMacros = body("macros")
  .optional()
  .custom((value: any) => {
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("macros must be an object.");
    }

    const allowedKeys = ["proteinG", "carbsG", "fatG", "fiberG", "sugarG"];

    for (const key of Object.keys(value)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`Invalid macros field: ${key}`);
      }

      const v = value[key];
      if (v === null) continue;

      const n = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(n)) throw new Error(`macros.${key} must be a number or null.`);
      if (n < 0 || n > 500) throw new Error(`macros.${key} out of allowed range.`);
    }

    return true;
  });

const validateFoodLog = [
  body("source")
    .exists()
    .withMessage("Invalid source.")
    .bail()
    .trim()
    .toUpperCase()
    .isIn(["NUTRITIONIX", "OPENFOODFACTS"])
    .withMessage("Invalid source."),

  body("externalId")
    .exists()
    .withMessage("externalId is required and must be <= 128 chars.")
    .bail()
    .trim()
    .isLength({ min: 1, max: 128 })
    .withMessage("externalId is required and must be <= 128 chars.")
    // barcode/code/identifier safe charset (no spaces)
    .matches(/^[a-zA-Z0-9:_\-\.]+$/)
    .withMessage("externalId contains invalid characters."),

  body("consumedAt")
    .exists()
    .withMessage("consumedAt must be a valid ISO8601 date/time.")
    .bail()
    .isISO8601()
    .withMessage("consumedAt must be a valid ISO8601 date/time."),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must be <= 500 chars."),

  validateRiskTags,

  handleValidation,
];

// Manual food logging validator externalId not required
const validateFoodManualLog = [
  body("name")
    .exists()
    .withMessage("name is required.")
    .bail()
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("name must be between 1 and 255 characters.")
    .matches(/^[\p{L}\p{N}\s,'\-().]+$/u)
    .withMessage("name contains invalid characters."),

  body("consumedAt")
    .exists()
    .withMessage("consumedAt must be a valid ISO8601 date/time.")
    .bail()
    .isISO8601()
    .withMessage("consumedAt must be a valid ISO8601 date/time."),

  // nutrition fields for manual entries
  validateCaloriesKcal,
  validateMacros,

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must be <= 500 chars."),

  validateRiskTags,

  handleValidation,
];

module.exports = { validateFoodSearch, validateFoodLog, validateFoodManualLog };

export {};