// Existing patient profile validation logic moved here so it can be unit tested

const ALLOWED_FIELDS = new Set([
  "dateOfBirth",
  "heightCm",
  "weightKg",
  "bloodType",
  "gender",
  "chronicConditions",
  "allergies",
  "medicalHistorySummary",
]);

// Using a Set for O(1) lookups instead of array
const allowedBloodTypes = new Set([
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "O_POS",
  "O_NEG",
  "AB_POS",
  "AB_NEG",
]);

const allowedGenders = new Set(["Male", "Female", "Other"]);

// Strict payload typing, only expected structure is returned after validation
type ProfilePayload = {
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
  gender: string | null;
  chronicConditions: string | null;
  allergies: string | null;
  medicalHistorySummary: string | null;
};

// Normalises and validates blood type input
const normaliseBloodType = (value: any) => {
  // empty/undefined as null
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  // Validate type + allowed values
  if (typeof value !== "string" || !allowedBloodTypes.has(value)) {
    return { ok: false, error: "Must be a valid blood type." };
  }

  return { ok: true, value };
};

// Normalises and validates gender input
const normaliseGender = (value: any) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  // Same validation approach as blood type
  if (typeof value !== "string" || !allowedGenders.has(value)) {
    return { ok: false, error: "Must be a valid gender option." };
  }

  return { ok: true, value };
};

const normaliseOptionalText = (value: any, maxLength: number) => {
  if (value === undefined || value === null) return { ok: true, value: null };

  // Enforce string type early 
  if (typeof value !== "string") return { ok: false, error: "Must be text." };

  const trimmed = value.trim();

  if (!trimmed) return { ok: true, value: null };

  // length restriction to prevent abuse / large payloads
  if (trimmed.length > maxLength) {
    return { ok: false, error: `Must be ${maxLength} characters or fewer.` };
  }

  // basic control character filtering, helps prevent injection / malformed data
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    return { ok: false, error: "Contains invalid characters." };
  }

  return { ok: true, value: trimmed };
};

const normaliseOptionalNumber = (value: any, min: number, max: number) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  // Convert to number explicitly
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `Must be between ${min} and ${max}.` };
  }

  // Round to 2 decimal places
  return { ok: true, value: Math.round(parsed * 100) / 100 };
};

// Date validation with strict format and logical constraints
const normaliseDateOfBirth = (value: any) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Must use YYYY-MM-DD format." };
  }

  // force UTC to avoid timezone bugs
  const date = new Date(`${value}T00:00:00.000Z`);

  // Validate that parsed date matches original input (catches invalid dates like 2025-02-30)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "Must be a valid date." };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  // Prevent future dates
  if (date > todayUtc) {
    return { ok: false, error: "Cannot be in the future." };
  }

  // Restrict unrealistic ages
  const oldest = new Date(todayUtc);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - 120);

  if (date < oldest) {
    return { ok: false, error: "Date is outside the allowed range." };
  }

  return { ok: true, value };
};

// Main validation entry point
const validatePatientProfilePayload = (
  body: any
): { ok: true; value: ProfilePayload } | { ok: false; error: string } => {

  // Basic payload validation (must be object, not array/null)
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid profile payload." };
  }

  // Reject unknown fields, prevents mass assignment vulnerabilities
  const unknownFields = Object.keys(body || {}).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length > 0) {
    return { ok: false, error: "Unexpected profile fields." };
  }

  // Validate each field individually (fail fast pattern)
  const dateOfBirth = normaliseDateOfBirth(body?.dateOfBirth);
  if (!dateOfBirth.ok) return { ok: false, error: `dateOfBirth ${dateOfBirth.error}` };

  const heightCm = normaliseOptionalNumber(body?.heightCm, 30, 250);
  if (!heightCm.ok) return { ok: false, error: `heightCm ${heightCm.error}` };

  const weightKg = normaliseOptionalNumber(body?.weightKg, 1, 400);
  if (!weightKg.ok) return { ok: false, error: `weightKg ${weightKg.error}` };

  const bloodType = normaliseBloodType(body?.bloodType);
  if (!bloodType.ok) return { ok: false, error: `bloodType ${bloodType.error}` };

  const gender = normaliseGender(body?.gender);
  if (!gender.ok) return { ok: false, error: `gender ${gender.error}` };

  const chronicConditions = normaliseOptionalText(body?.chronicConditions, 1000);
  if (!chronicConditions.ok) return { ok: false, error: `chronicConditions ${chronicConditions.error}` };

  const allergies = normaliseOptionalText(body?.allergies, 1000);
  if (!allergies.ok) return { ok: false, error: `allergies ${allergies.error}` };

  const medicalHistorySummary = normaliseOptionalText(body?.medicalHistorySummary, 3000);
  if (!medicalHistorySummary.ok) {
    return { ok: false, error: `medicalHistorySummary ${medicalHistorySummary.error}` };
  }

  // Return fully normalised + safe payload
  return {
    ok: true,
    value: {
      dateOfBirth: dateOfBirth.value ?? null,
      heightCm: heightCm.value ?? null,
      weightKg: weightKg.value ?? null,
      bloodType: bloodType.value ?? null,
      gender: gender.value ?? null,
      chronicConditions: chronicConditions.value ?? null,
      allergies: allergies.value ?? null,
      medicalHistorySummary: medicalHistorySummary.value ?? null,
    },
  };
};

module.exports = { validatePatientProfilePayload };

export {};