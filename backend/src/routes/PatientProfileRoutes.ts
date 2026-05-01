const express = require("express");

const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { PatientProfile } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");
const { encryptProfileField, decryptProfileField } = require("../utils/patientProfileCrypto");
const { validatePatientProfilePayload } = require("../utils/validators/PatientProfileValidators");

const router = express.Router();

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
      const validated = validatePatientProfilePayload(req.body);
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
