const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Encrypt file buffers using AES-256-GCM
// so files are encrypted never stored in plaintext
// encryption key is 32-byte (256-bit) hex string stored in .env
const keyHex = process.env.FILE_ENCRYPTION_KEY;

if (!keyHex || keyHex.length !== 64) {
  console.warn(
    "Warning: FILE_ENCRYPTION_KEY is missing or not 32 bytes in hex. Encryption will not be secure until this is set."
  );
}

const ENCRYPTION_KEY = keyHex ? Buffer.from(keyHex, "hex") : crypto.randomBytes(32);

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

module.exports = {
  encryptAndSaveFile,
  ENCRYPTED_DIR,
};
