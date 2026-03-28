const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const { Op } = require("sequelize");
const path = require("path");
// https://github.com/expressjs/multer#memorystorage
// https://dev.to/hexshift/a-complete-guide-to-handling-file-uploads-with-multer-in-nodejs-4iig
// Accepts only PDF, JPG, JPEG, PNG and rejects dangerous extensions
// multer memory storage so files are never written unencrypted and logs audit event
// Middleware to check JWT access token
const { authenticateToken } = require("../middleware/AuthMiddleware");
// Encryption helper
const { encryptAndSaveFile, decryptStoredFile, ENCRYPTED_DIR } = require("../utils/FileEncryption");
// Audit logging helper
const { logAudit } = require("../utils/AuditLogger");
const { FileRecord, DoctorPatientAssignment, User } = require("../config/db");
const router = express.Router();
// Antivirus scanner (ClamAV CLI)
const { scanWithClamAV } = require("../utils/ClamAVScanner");

const getValidId = (value: any) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
};

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

// List file metadata only (never returns file contents)
router.get(
  "/list",
  authenticateToken,
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      let whereClause: any = {};

      if (role === "patient") {
        whereClause.ownerPatientId = userId;
      } else if (role === "doctor") {
        const assignments = await DoctorPatientAssignment.findAll({
          where: { doctorId: userId, status: "ACTIVE" },
          attributes: ["patientId"],
        });

        const patientIds = assignments.map((assignment: any) => assignment.patientId);

        if (patientIds.length === 0) {
          await logAudit(userId, "FILE_VIEW", req.ip, {
            role,
            fileCount: 0,
          });

          return res.json({ files: [] });
        }

        whereClause.ownerPatientId = { [Op.in]: patientIds };
      } else {
        await logAudit(userId, "FILE_VIEW", req.ip, {
          role,
          reason: "forbidden_role",
        });

        return res.status(403).json({ error: "Forbidden." });
      }

      const files = await FileRecord.findAll({
        where: whereClause,
        attributes: [
          "id",
          "ownerPatientId",
          "uploadedByUserId",
          "originalName",
          "mimeType",
          "sizeBytes",
          "storageProvider",
          "createdAt",
        ],
        include: [
          {
            model: User,
            as: "ownerPatient",
            attributes: ["email"],
          },
          {
            model: User,
            as: "uploadedByUser",
            attributes: ["email"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      await logAudit(userId, "FILE_VIEW", req.ip, {
        role,
        fileCount: files.length,
      });

      return res.json({
        files: files.map((file: any) => ({
          id: file.id,
          ownerPatientId: file.ownerPatientId,
          ownerPatientEmail: file.ownerPatient?.email || null,
          uploadedByUserId: file.uploadedByUserId,
          uploaderEmail: file.uploadedByUser?.email || null,
          originalName: file.originalName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          storageProvider: file.storageProvider,
          createdAt: file.createdAt,
        })),
      });
    } catch (err: any) {
      console.error("File metadata list error:", err?.message || err);

      await logAudit(req?.user?.id || null, "FILE_VIEW", req.ip, {
        error: err?.message,
      });

      return res.status(500).json({ error: "Unable to list file metadata." });
    }
  }
);

// Download and decrypt a stored file only after access checks pass
router.get(
  "/download/:id",
  authenticateToken,
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const fileId = parseInt(req.params.id, 10);

      if (Number.isNaN(fileId) || fileId <= 0) {
        return res.status(400).json({ error: "Invalid file id." });
      }

      const fileRecord = await FileRecord.findByPk(fileId);

      if (!fileRecord) {
        return res.status(404).json({ error: "File not found." });
      }

      let allowed = false;

      if (role === "patient") {
        allowed = fileRecord.ownerPatientId === userId;
      } else if (role === "doctor") {
        const activeAssignment = await DoctorPatientAssignment.findOne({
          where: {
            doctorId: userId,
            patientId: fileRecord.ownerPatientId,
            status: "ACTIVE",
          },
          attributes: ["id"],
        });

        allowed = !!activeAssignment;
      }

      if (!allowed) {
        await logAudit(userId, "FILE_DOWNLOAD", req.ip, {
          fileRecordId: fileId,
          role,
          status: "forbidden",
        });

        return res.status(403).json({ error: "Forbidden." });
      }

      const decryptedFile = decryptStoredFile(fileRecord.storageKey);

      await logAudit(userId, "FILE_DOWNLOAD", req.ip, {
        fileRecordId: fileRecord.id,
        ownerPatientId: fileRecord.ownerPatientId,
        role,
        status: "success",
      });

      res.setHeader("Content-Type", fileRecord.mimeType || "application/octet-stream");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`
      );

      return res.send(decryptedFile);
    } catch (err: any) {
      console.error("File download error:", err?.message || err);

      await logAudit(req?.user?.id || null, "FILE_DOWNLOAD", req.ip, {
        fileRecordId: req?.params?.id || null,
        status: "error",
      });

      return res.status(500).json({ error: "File download failed. Please try again." });
    }
  }
);

// Delete stored file after access checks and keep metadata as a soft deleted record
router.delete(
  "/delete/:id",
  authenticateToken,
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      const fileId = parseInt(req.params.id, 10);

      if (Number.isNaN(fileId) || fileId <= 0) {
        return res.status(400).json({ error: "Invalid file id." });
      }

      const fileRecord = await FileRecord.findByPk(fileId);

      if (!fileRecord) {
        return res.status(404).json({ error: "File not found." });
      }

      let allowed = false;

      if (role === "patient") {
        allowed = fileRecord.ownerPatientId === userId;
      } else if (role === "doctor") {
        const activeAssignment = await DoctorPatientAssignment.findOne({
          where: {
            doctorId: userId,
            patientId: fileRecord.ownerPatientId,
            status: "ACTIVE",
          },
          attributes: ["id"],
        });

        allowed = !!activeAssignment;
      }

      if (!allowed) {
        await logAudit(userId, "FILE_DELETE", req.ip, {
          fileRecordId: fileId,
          role,
          status: "forbidden",
        });

        return res.status(403).json({ error: "Forbidden." });
      }

      try {
        fs.unlinkSync(path.join(ENCRYPTED_DIR, fileRecord.storageKey));
      } catch (deleteError: any) {
        if (deleteError?.code !== "ENOENT") {
          throw deleteError;
        }
      }

      await fileRecord.update({ deletedByUserId: userId });
      await fileRecord.destroy();

      await logAudit(userId, "FILE_DELETE", req.ip, {
        fileRecordId: fileRecord.id,
        ownerPatientId: fileRecord.ownerPatientId,
        role,
        status: "success",
      });

      return res.json({ message: "File deleted successfully." });
    } catch (err: any) {
      console.error("File delete error:", err?.message || err);

      await logAudit(req?.user?.id || null, "FILE_DELETE", req.ip, {
        fileRecordId: req?.params?.id || null,
        status: "error",
      });

      return res.status(500).json({ error: "File delete failed. Please try again." });
    }
  }
);

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
      const role = user.role;
      let ownerPatientId = user.id;

      if (role === "doctor") {
        ownerPatientId = getValidId(req.body.ownerPatientId);

        if (!ownerPatientId) {
          return res.status(400).json({ error: "Valid ownerPatientId is required." });
        }

        const activeAssignment = await DoctorPatientAssignment.findOne({
          where: {
            doctorId: user.id,
            patientId: ownerPatientId,
            status: "ACTIVE",
          },
          attributes: ["id"],
        });

        if (!activeAssignment) {
          await logAudit(user.id, "FILE_UPLOAD", req.ip, {
            ownerPatientId,
            role,
            status: "forbidden",
          });

          return res.status(403).json({ error: "Forbidden." });
        }
      } else if (role !== "patient") {
        await logAudit(user.id, "FILE_UPLOAD", req.ip, {
          role,
          status: "forbidden",
        });

        return res.status(403).json({ error: "Forbidden." });
      }

      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const size = req.file.size;

      // writes the file to a temporary OS directory, scans with ClamAV, then deletes it
      // prevent plaintext storage while using a real antivirus engine
      const scanResult = await scanWithClamAV(fileBuffer, originalName);

      if (scanResult.scanFailed) {
        await logAudit(user.id, "FILE_SCAN_FAILED", req.ip, {
          originalName,
          ownerPatientId,
          scanOutput: scanResult.result,
        });

        return res.status(400).json({
          error: "File could not be scanned safely. Upload was blocked.",
        });
      }

      if (scanResult.infected) {
        // Log security incident for forensic traceability
        await logAudit(user.id, "VIRUS_DETECTED", req.ip, {
          scanOutput: scanResult.result, // clamscan reported
        });

        return res.status(400).json({
          error: "Virus detected, the upload was blocked.",
        });
      }

      // Encrypt and store file (only after clean scan)
      const encryptedName = encryptAndSaveFile(fileBuffer, originalName);
      const sha256 = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      let fileRecord;

      try {
        fileRecord = await FileRecord.create({
          ownerPatientId,
          uploadedByUserId: user.id,
          originalName,
          mimeType,
          sizeBytes: size,
          storageProvider: "local",
          storageKey: encryptedName,
          sha256,
        });
      } catch (metadataError: any) {
        try {
          fs.unlinkSync(path.join(ENCRYPTED_DIR, encryptedName));
        } catch (cleanupError: any) {
          console.error(
            "Encrypted file cleanup error:",
            cleanupError?.message || cleanupError
          );
        }

        throw new Error(metadataError?.message || "File metadata creation failed.");
      }

      // Log audit entry
      await logAudit(user.id, "FILE_UPLOAD", req.ip, {
        ownerPatientId,
        storedFile: encryptedName,
        fileRecordId: fileRecord.id,
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
      await logAudit(req?.user?.id || null, "UPLOAD_ERROR", req.ip, {
        error: err?.message,
      });

      return res
        .status(500)
        .json({ error: "File upload failed. Please try again." });
    }
  }
);

module.exports = router;

export {};