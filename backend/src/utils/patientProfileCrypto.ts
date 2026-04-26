const crypto = require("crypto");

// AES-256-GCM chosen because it provides both encryption and integrity (auth tag)
// learned this from Node.js crypto docs + general encryption best practices
const ALGORITHM = "aes-256-gcm";

// loads encryption key from environment variable
// key must be exactly 32 bytes for AES-256
const getEncryptionKey = () => {
  const rawKey = process.env.PATIENT_PROFILE_ENCRYPTION_KEY || "";

  if (!rawKey) {
    // fail fast if key is not configured (secure by default)
    throw new Error("Patient profile encryption key is not configured.");
  }

  // allow hex format (64 hex characters = 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  try {
    // also allow base64 format for flexibility in env config
    const decoded = Buffer.from(rawKey, "base64");

    if (decoded.length === 32) {
      return decoded;
    }
  } catch (_error) {
    // ignored, handled below
  }

  // clear error message so misconfiguration is obvious
  throw new Error(
    "PATIENT_PROFILE_ENCRYPTION_KEY must be a 64-character hex string or a base64 string that decodes to 32 bytes."
  );
};

// encrypts a single profile field (used for sensitive medical text fields)
const encryptProfileField = (value: string) => {
  const key = getEncryptionKey();

  // 12 byte IV is standard for AES-GCM (recommended size)
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // convert plaintext to encrypted binary
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return {
    // stored as base64 for safe DB storage
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),

    // auth tag ensures data has not been tampered (integrity check)
    tag: cipher.getAuthTag().toString("base64"),
  };
};

// decrypts encrypted profile field back into readable text
const decryptProfileField = (
  ciphertextB64: string,
  ivB64: string,
  tagB64: string
) => {
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );

  // must set auth tag before final() or decryption will fail
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

module.exports = { encryptProfileField, decryptProfileField };

export {};