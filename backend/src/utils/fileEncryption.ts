const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// https://stackoverflow.com/questions/77220309/aes-256-gcm-encryption-in-node-js-and-decryption-in-golang
// Encrypt file buffers using AES-256-GCM
// so files are encrypted never stored in plaintext
// encryption key is 32-byte (256-bit) hex string stored in .env
const keyHex = process.env.FILE_ENCRYPTION_KEY;

if (!keyHex || keyHex.length !== 64) {
  throw new Error(
    "FILE_ENCRYPTION_KEY must be set to a 64 character hex string."
  );
}

const ENCRYPTION_KEY = Buffer.from(keyHex, "hex");

// Directory where encrypted files will be stored
const ENCRYPTED_DIR = path.join(__dirname, "..", "..", "encrypted_uploads");

if (!fs.existsSync(ENCRYPTED_DIR)) {
  fs.mkdirSync(ENCRYPTED_DIR, { recursive: true });
}

 //Returns the generated encrypted file name (not the full path)
function encryptAndSaveFile(buffer: Buffer, originalName: string): string {
  // Generate a random 12-byte IV for GCM mode
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Combine iv + authTag + encrypted content
  const payload = Buffer.concat([iv, authTag, encrypted]);
  // Generate random file name to avoid exposing original name
  const randomName = crypto.randomBytes(16).toString("hex");
  const storedFileName = randomName + ".enc";

  const fullPath = path.join(ENCRYPTED_DIR, storedFileName);

  fs.writeFileSync(fullPath, payload);

  return storedFileName;
}

function decryptStoredFile(storedFileName: string): Buffer {
  const fullPath = path.join(ENCRYPTED_DIR, storedFileName);
  const payload = fs.readFileSync(fullPath);

  if (payload.length < 29) {
    throw new Error("Encrypted file payload is invalid.");
  }

  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

module.exports = {
  encryptAndSaveFile,
  decryptStoredFile,
  ENCRYPTED_DIR,
};

export {};