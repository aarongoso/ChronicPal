const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm"; // authenticated encryption mode providing confidentiality and integrity

const getEncryptionKey = () => {
  const rawKey = process.env.MFA_ENCRYPTION_KEY || "";

  if (!rawKey) {
    throw new Error("MFA encryption key is not configured.");
  }

  // Support a 64 character hex key (32 bytes) which is required for AES-256
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  // Support a base64 encoded key that decodes to 32 bytes
  try {
    const decoded = Buffer.from(rawKey, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  } catch (_error) {
    // if decoding fails we fall through to deterministic key derivation
  }

  // Derive a 32-byte key using SHA-256
  // guarantees a valid AES-256 key even if a plain string is provided
  return crypto.createHash("sha256").update(rawKey).digest();
};

const encryptMfaSecret = (plainTextSecret: string) => {
  const key = getEncryptionKey();

  // GCM requires a unique IV per encryption to prevent ciphertext reuse
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plainTextSecret, "utf8"),
    cipher.final(),
  ]);

  // authentication tag allows detection of tampering during decryption
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
};

const decryptMfaSecret = (
  ciphertextB64: string,
  ivB64: string,
  tagB64: string
) => {
  const key = getEncryptionKey();

  // recreate decipher using same algorithm, key, and IV used during encryption
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );

  // GCM requires the authentication tag to verify ciphertext integrity
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

module.exports = { encryptMfaSecret, decryptMfaSecret };

export {};