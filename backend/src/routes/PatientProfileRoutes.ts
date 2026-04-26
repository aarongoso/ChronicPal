const express = require("express");

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { PatientProfile } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { encryptProfileField, decryptProfileField } = require("../utils/patientProfileCrypto");

const router = express.Router();

// only allow profile fields that are meant to be updated from the frontend
// OWASP input validation guidance
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

// fixed blood type values keep the data consistent
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

// stored as gender in the DB but displayed as biological sex in the UI to look more professional
const allowedGenders = new Set([
  "Male",
  "Female",
  "Other",
]);

// encrypted sensitive free text medical data because it contains detailed health information,
// stored lower risk fields in plaintext to balance security with system simplicity
const encryptedFields = [
  "chronicConditions",
  "allergies",
  "medicalHistorySummary",
] as const;

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

const normaliseBloodType = (value: any) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  // reject anything outside the expected blood type list
  if (typeof value !== "string" || !allowedBloodTypes.has(value)) {
    return { ok: false, error: "Must be a valid blood type." };
  }

  return { ok: true, value };
};

const normaliseGender = (value: any) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  // keep this as a controlled field rather than accepting any text
  if (typeof value !== "string" || !allowedGenders.has(value)) {
    return { ok: false, error: "Must be a valid gender option." };
  }

  return { ok: true, value };
};

const normaliseOptionalText = (value: any, maxLength: number) => {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "Must be text." };

  const trimmed = value.trim();

  // empty text fields stored as null = clean DB
  if (!trimmed) return { ok: true, value: null };

  if (trimmed.length > maxLength) return { ok: false, error: `Must be ${maxLength} characters or fewer.` };

  // basic control character check so odd/binary input is not accepted
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(trimmed)) {
    return { ok: false, error: "Contains invalid characters." };
  }

  return { ok: true, value: trimmed };
};

const normaliseOptionalNumber = (value: any, min: number, max: number) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  const parsed = Number(value);

  // simple range validation for realistic height/weight values
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return { ok: false, error: `Must be between ${min} and ${max}.` };
  }

  // two decimal places is more than enough for this profile data
  return { ok: true, value: Math.round(parsed * 100) / 100 };
};

const normaliseDateOfBirth = (value: any) => {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };

  // browser date input sends YYYY-MM-DD, so keep backend validation strict
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: "Must use YYYY-MM-DD format." };
  }

  // UTC midnight avoids timezone shifting when validating DATEONLY values
  const date = new Date(`${value}T00:00:00.000Z`);

  // catches invalid dates like 2026-02-31
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: "Must be a valid date." };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  if (date > todayUtc) {
    return { ok: false, error: "Cannot be in the future." };
  }

  // sanity check so unrealistic ages are rejected
  const oldest = new Date(todayUtc);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - 120);

  if (date < oldest) {
    return { ok: false, error: "Date is outside the allowed range." };
  }

  return { ok: true, value };
};

const decryptField = (profile: any, field: string) => {
  const ciphertext = profile?.[`${field}Ciphertext`];
  const iv = profile?.[`${field}Iv`];
  const tag = profile?.[`${field}Tag`];

  // if any part is missing, return null rather than throwing an error
  if (!ciphertext || !iv || !tag) return null;

  return decryptProfileField(ciphertext, iv, tag);
};

const serializeProfile = (profile: any) => {
  if (!profile) {
    return {
      profile: null,
    };
  }

  // convert DB values into a frontend friendly shape
  return {
    profile: {
      id: profile.id,
      userId: profile.userId,
      dateOfBirth: profile.dateOfBirth || null,
      heightCm: profile.heightCm === null || profile.heightCm === undefined ? null : Number(profile.heightCm),
      weightKg: profile.weightKg === null || profile.weightKg === undefined ? null : Number(profile.weightKg),
      bloodType: profile.bloodType || null,
      gender: profile.gender || null,

      // decrypt only for the authorised patient reading their own profile
      chronicConditions: decryptField(profile, "chronicConditions"),
      allergies: decryptField(profile, "allergies"),
      medicalHistorySummary: decryptField(profile, "medicalHistorySummary"),

      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    },
  };
};

const validatePayload = (body: any): { ok: true; value: ProfilePayload } | { ok: false; error: string } => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid profile payload." };
  }

  // fail closed if the client sends fields that are not part of the profile contract
  const unknownFields = Object.keys(body || {}).filter((field) => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length > 0) {
    return { ok: false, error: "Unexpected profile fields." };
  }

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

const applyEncryptedField = (values: any, field: typeof encryptedFields[number], value: string | null) => {
  if (!value) {
    // clearing a value also clears its ciphertext, IV and tag
    values[`${field}Ciphertext`] = null;
    values[`${field}Iv`] = null;
    values[`${field}Tag`] = null;
    return;
  }

  const encrypted = encryptProfileField(value);

  // AES-GCM stores ciphertext plus IV and auth tag for later decryption/integrity check
  values[`${field}Ciphertext`] = encrypted.ciphertext;
  values[`${field}Iv`] = encrypted.iv;
  values[`${field}Tag`] = encrypted.tag;
};

router.get(
  "/",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      // patients can only load their own profile using req.user.id
      const profile = await PatientProfile.findOne({ where: { userId } });

      await logAudit(userId, "PATIENT_PROFILE_VIEW", req.ip, {
        status: "success",
        profileId: profile?.id || null,
      });

      return res.json(serializeProfile(profile));
    } catch (error: any) {
      await logAudit(userId, "PATIENT_PROFILE_VIEW", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to load patient profile." });
    }
  }
);

router.put(
  "/",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    const userId = req.user.id;

    try {
      const validated = validatePayload(req.body);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error });
      }

      const payload = validated.value;

      // structured fields are stored directly after validation
      const values: any = {
        userId,
        dateOfBirth: payload.dateOfBirth,
        heightCm: payload.heightCm,
        weightKg: payload.weightKg,
        bloodType: payload.bloodType,
        gender: payload.gender,
      };

      // sensitive free text fields are encrypted before saving
      encryptedFields.forEach((field) => applyEncryptedField(values, field, payload[field]));

      const existing = await PatientProfile.findOne({ where: { userId } });

      // simple update or create pattern because each patient only has one profile
      const profile = existing
        ? await existing.update(values)
        : await PatientProfile.create(values);

      await logAudit(userId, existing ? "PATIENT_PROFILE_UPDATE" : "PATIENT_PROFILE_CREATE", req.ip, {
        status: "success",
        profileId: profile.id,

        // log field names only, never raw medical values
        fieldsUpdated: (Object.keys(payload) as Array<keyof ProfilePayload>).filter((field) => payload[field] !== null),
      });

      return res.json(serializeProfile(profile));
    } catch (error: any) {
      await logAudit(userId, "PATIENT_PROFILE_UPDATE", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to save patient profile." });
    }
  }
);

module.exports = router;

export {};
