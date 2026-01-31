const { body } = require("express-validator");
// Request validation for AI inference proxy routes
// express-validator patterns and matchedData docs
const predictValidators = [
  // reject PII fields if they appear
  body("userId").not().exists().withMessage("Do not include userId (anonymised payload only)."),
  body("email").not().exists().withMessage("Do not include email (anonymised payload only)."),
  body("name").not().exists().withMessage("Do not include name (anonymised payload only)."),

  // symptoms: optional array
  body("symptoms").optional().isArray().withMessage("symptoms must be an array."),
  body("symptoms.*.name").optional().isString().trim().isLength({ min: 1, max: 80 }),
  body("symptoms.*.severity")
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage("symptom severity must be between 0 and 10."),

  // foodLogs: optional array
  body("foodLogs").optional().isArray().withMessage("foodLogs must be an array."),
  body("foodLogs.*.calories")
    .optional()
    .isFloat({ min: 0, max: 5000 })
    .withMessage("calories must be a sensible number."),

  // medicationLogs: optional array
  body("medicationLogs").optional().isArray().withMessage("medicationLogs must be an array."),
  body("medicationLogs.*.name").optional().isString().trim().isLength({ min: 1, max: 120 }),
];

module.exports = {
  predictValidators,
};

export {};