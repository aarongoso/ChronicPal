const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  encryptProfileField,
  decryptProfileField,
} = require("../utils/patientProfileCrypto");

const {
  validatePatientProfilePayload,
} = require("../utils/validators/PatientProfileValidators");

describe("bcrypt password hashing", () => {
  test("hashes a password and compares correct and wrong passwords", async () => {
    const password = "Password123!";

    // Hash with salt rounds
    const hash = await bcrypt.hash(password, 10);

    // Jest docs teach expect
    // raw password is never stored
    expect(hash).not.toBe(password);

    // correct password should match, incorrect should fail
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare("WrongPassword123!", hash)).toBe(false);
  });
});

describe("JWT token generation and verification", () => {
  test("signs and verifies a JWT payload", () => {
    const secret = "test-secret";

    // Typical payload structure used in authentication (id, email, role)
    const payload = {
      id: 1,
      email: "patient@example.com",
      role: "patient",
    };

    // generate short lived token
    const token = jwt.sign(payload, secret, { expiresIn: "15m" });

    // verify token integrity and decode payload
    const decoded = jwt.verify(token, secret);

    // integrity check
    expect(decoded).toMatchObject(payload);
  });
});

describe("AES-256-GCM patient profile encryption", () => {
  const originalKey = process.env.PATIENT_PROFILE_ENCRYPTION_KEY;

  beforeEach(() => {
    // 64 hex chars = 32 bytes required for AES-256
    // fixed key for deterministic testing
    process.env.PATIENT_PROFILE_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    process.env.PATIENT_PROFILE_ENCRYPTION_KEY = originalKey;
  });

  test("encrypts and decrypts a profile field", () => {
    const plaintext = "Penicillin allergy";

    const encrypted = encryptProfileField(plaintext);

    // Decrypt using stored IV + auth tag (AES-GCM requirement)
    const decrypted = decryptProfileField(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag
    );

    // ciphertext is not plain text
    expect(encrypted.ciphertext).not.toBe(plaintext);

    // make sure integrity
    expect(decrypted).toBe(plaintext);
  });

  test("throws when ciphertext is tampered with", () => {
    const encrypted = encryptProfileField("Crohn's disease");

    // simulate attacker modifying encrypted data
    const tamperedCiphertext = Buffer.from("tampered").toString("base64");

    // AES-GCM should fail authentication
    expect(() => {
      decryptProfileField(tamperedCiphertext, encrypted.iv, encrypted.tag);
    }).toThrow();
  });
});

describe("patient profile validation", () => {
  test("accepts a valid profile payload", () => {
    const result = validatePatientProfilePayload({
      dateOfBirth: "2001-05-20",
      heightCm: 172,
      weightKg: 70,
      bloodType: "O_NEG",
      gender: "Female",
      allergies: "Penicillin",
    });

    // Should pass validation and return normalised values
    expect(result.ok).toBe(true);
    expect(result.value.heightCm).toBe(172);
    expect(result.value.bloodType).toBe("O_NEG");
    expect(result.value.allergies).toBe("Penicillin");
  });

  test("rejects an unknown profile field", () => {
    const result = validatePatientProfilePayload({
      heightCm: 180,
      isAdmin: true, // Attempted mass assignment / privilege escalation
    });

    // Should fail due to strict allowed fields check
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Unexpected profile fields.");
  });
});