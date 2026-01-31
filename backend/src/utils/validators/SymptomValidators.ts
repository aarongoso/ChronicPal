const { query, body } = require("express-validator");
// Symptom logging validation
const validateSymptomLog = [
  body("symptomName")
    .isString()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage("symptomName must be between 2 and 120 characters."),

  body("severity")
    .isInt({ min: 1, max: 10 })
    .withMessage("severity must be an integer between 1 and 10."),

  // loggedAt optional, backend defaults to now if mising
  body("loggedAt")
    .optional()
    .isISO8601()
    .withMessage("loggedAt must be a valid ISO8601 datetime."),

  body("notes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must be max 500 chars."),
];

const validateSymptomLogQuery = [
  query("limit").optional().isInt({ min: 1, max: 200 }),
  query("offset").optional().isInt({ min: 0, max: 5000 }),
  query("from").optional().isISO8601(),
  query("to").optional().isISO8601(),
];

module.exports = { validateSymptomLog, validateSymptomLogQuery };

export {};