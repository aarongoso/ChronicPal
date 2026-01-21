const express = require("express");
const multer = require("multer");
const path = require("path");
// https://github.com/expressjs/multer#memorystorage
// https://dev.to/hexshift/a-complete-guide-to-handling-file-uploads-with-multer-in-nodejs-4iig
// Accepts only PDF, JPG, JPEG, PNG and rejects dangerous extensions
// multer memory storage so files are never written unencrypted and logs audit event
// Middleware to check JWT access token
const { authenticateToken } = require("../middleware/AuthMiddleware");
// Encryption helper
const { encryptAndSaveFile } = require("../utils/FileEncryption");
// Audit logging helper
const { logAudit } = require("../utils/AuditLogger");
const router = express.Router();
// Antivirus scanner (ClamAV CLI)
const { scanWithClamAV } = require("../utils/ClamAVScanner");

// Multer using in memory storage
// Files will remain in RAM and never be written in plaintext
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Allowed MIME types
    // added application/zip strictly for EICAR (ClamAV scan) testing only
    const allowedMimeTypes = ["application/pdf", "image/png", "image/jpeg", "application/zip", "application/x-zip-compressed"];

    // Blocked extensions
    const blockedExtensions = [".exe", ".js", ".bat", ".cmd", ".sh"];

    const ext = path.extname(file.originalname).toLowerCase();

    if (blockedExtensions.includes(ext)) {
      return cb(new Error("This file type is not allowed."));
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF, JPG, and PNG files are allowed."));
    }

    cb(null, true);
  },
});

// Only authenticated users can upload
// File has to be provided in "file" form data field
router.post(
  "/upload",
  authenticateToken,
  upload.single("file"),
  async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const user = req.user; // Provided by authenticateToken middleware

      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const size = req.file.size;

      // writes the file to a temporary OS directory, scans with ClamAV, then deletes it
      // prevent plaintext storage while using a real antivirus engine
      const scanResult = await scanWithClamAV(fileBuffer, originalName);

      if (scanResult.infected) {
        // Log security incident for forensic traceability
        await logAudit(user.id, "VIRUS_DETECTED", req.ip, {
          originalName,
          scanOutput: scanResult.result, // clamscan reported
        });

        return res.status(400).json({
          error: "Virus detected — upload blocked.",
        });
      }

      // Encrypt and store file (only after clean scan)
      const encryptedName = encryptAndSaveFile(fileBuffer, originalName);

      // Log audit entry
      await logAudit(user.id, "FILE_UPLOAD", req.ip, {
        originalName,
        storedFile: encryptedName,
        mimeType,
        size,
      });

      console.log("Encrypted file stored as:", encryptedName);

      return res.status(201).json({
        message: "File uploaded and encrypted successfully.",
        metadata: { originalName, mimeType, size },
      });
    } catch (err: any) {
      console.error("File upload error:", err?.message || err);

      // Log the failure
      await logAudit(
        req?.user?.id || null,
        "UPLOAD_ERROR",
        req.ip,
        { error: err?.message }
      );

      return res
        .status(500)
        .json({ error: "File upload failed. Please try again." });
    }
  }
);

module.exports = router;

export {};