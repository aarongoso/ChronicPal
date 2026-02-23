const crypto = require("crypto");
const { validationResult, matchedData } = require("express-validator");
const { DoctorAccountRequest, User, sequelize } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

const hashValue = (value: string | null) => {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
};

// Normalise before hashing so the same real world value always hashes consistently
// this avoids "A@B.com" and "a@b.com" producing different hashes
const normalizeEmail = (value: any) => {
  if (typeof value !== "string") return null;
  return value.trim().toLowerCase();
};

const normalizeLicense = (value: any) => {
  if (typeof value !== "string") return null;
  return value.trim().toUpperCase();
};

const getEmailHash = (email: any) => hashValue(normalizeEmail(email));
const getLicenseHash = (license: any) => hashValue(normalizeLicense(license));

const parseId = (value: any) => {
  const id = parseInt(value, 10);
  return Number.isNaN(id) || id <= 0 ? null : id;
};

// POST /public/doctor-requests
// Public doctor request submission (anti enumeration response)
// Always returns a generic response (prevents email/license probing)
// Sanitisation failures audut logged (metadata only)
exports.submitDoctorRequest = async (req: any, res: any) => {
  const errors = validationResult(req);
  const emailHash = getEmailHash(req.body?.email);
  const licenseHash = getLicenseHash(req.body?.licenseNumber);

  if (!errors.isEmpty()) {
    await logAudit(null, "INPUT_SANITISATION_FAILURE", req.ip, {
      errorCount: errors.array().length,
      fields: errors.array().map((e: any) => e.param || e.path || e.location || "unknown"),
      emailHash,
      licenseHash,
    });

    // Anti enumeration return same response whether input is valid or not
    return res.status(202).json({ message: "Request received" });
  }

  // matchedData makes sure only validated fields are accepted
  const data = matchedData(req, { locations: ["body"], includeOptionals: true });
  const email = normalizeEmail(data.email);
  const licenseNumber = normalizeLicense(data.licenseNumber);

  try {
    const created = await DoctorAccountRequest.create({
      fullName: data.fullName,
      email,
      clinicOrHospital: data.clinicOrHospital,
      licenseNumber,
      notes: data.notes || null,
      status: "PENDING",
    });

    await logAudit(null, "DOCTOR_REQUEST_SUBMITTED", req.ip, {
      requestId: created.id,
      emailHash,
      licenseHash,
    });
  } catch (error: any) {
    // Unique constraint is treated as "already submitted" 
    // but still returns generic response (anti probing)
    if (error?.name === "SequelizeUniqueConstraintError") {
      await logAudit(null, "DOCTOR_REQUEST_DUPLICATE", req.ip, {
        emailHash,
        licenseHash,
      });
    } else {
      // generic response + audit trail only (no sensitive details leaked)
      await logAudit(null, "DOCTOR_REQUEST_SUBMITTED", req.ip, {
        status: "error",
        emailHash,
        licenseHash,
      });
    }
  }

  return res.status(202).json({ message: "Request received" });
};

// GET /admin/doctor-requests?status=PENDING
// Admin only: list requests by status
exports.listDoctorRequests = async (req: any, res: any) => {
  const adminId = req.user?.id || null;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Invalid status filter." });
  }

  try {
    const whereClause: any = {};
    const statusFilter = req.query.status ? String(req.query.status) : null;
    if (statusFilter) whereClause.status = statusFilter;

    const requests = await DoctorAccountRequest.findAll({
      where: whereClause,
      order: [["createdAt", "DESC"]],
    });

    // Audit required for admin actions (metadata only)
    await logAudit(adminId, "DOCTOR_REQUEST_LIST_VIEW", req.ip, {
      statusFilter: statusFilter || "ALL",
      count: requests.length,
    });

    return res.status(200).json({
      count: requests.length,
      requests: requests.map((r: any) => ({
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        clinicOrHospital: r.clinicOrHospital,
        licenseNumber: r.licenseNumber,
        // notes omitted in list view to avoid exposing free text in bulk
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        doctorUserId: r.doctorUserId,
        activationTokenExpiresAt: r.activationTokenExpiresAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to list requests." });
  }
};

// GET /admin/doctor-requests/:id
// Adminonly view request details
exports.getDoctorRequestById = async (req: any, res: any) => {
  const adminId = req.user?.id || null;

  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid id." });
  }

  try {
    const request = await DoctorAccountRequest.findOne({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: "Request not found." });
    }

    // Audit details are hashed so logs remain useful without storing raw identifiers
    await logAudit(adminId, "DOCTOR_REQUEST_VIEW", req.ip, {
      requestId: request.id,
      emailHash: getEmailHash(request.email),
      licenseHash: getLicenseHash(request.licenseNumber),
      status: request.status,
    });

    return res.status(200).json({
      id: request.id,
      fullName: request.fullName,
      email: request.email,
      clinicOrHospital: request.clinicOrHospital,
      licenseNumber: request.licenseNumber,
      notes: request.notes,
      status: request.status,
      reviewedBy: request.reviewedBy,
      reviewedAt: request.reviewedAt,
      doctorUserId: request.doctorUserId,
      activationTokenExpiresAt: request.activationTokenExpiresAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to fetch request." });
  }
};

// POST /admin/doctor-requests/:id/approve
// Uses a DB transaction + row lock to prevent double approval race conditions
// Creates doctor user with placeholder password, then doctor sets real password via activation
exports.approveDoctorRequest = async (req: any, res: any) => {
  const adminId = req.user?.id || null;
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid id." });
  }

  const request = await DoctorAccountRequest.findOne({ where: { id } });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  if (request.status !== "PENDING") {
    return res.status(409).json({ error: "Request is not pending." });
  }

  const emailHash = getEmailHash(request.email);
  const licenseHash = getLicenseHash(request.licenseNumber);

  const transaction = await sequelize.transaction();
  try {
    // Lock request row so two admins cant approve at the same time (prevents duplicate doctor users)
    const requestLocked = await DoctorAccountRequest.findOne({
      where: { id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!requestLocked) {
      await transaction.rollback();
      return res.status(404).json({ error: "Request not found." });
    }

    if (requestLocked.status !== "PENDING") {
      await transaction.rollback();
      return res.status(409).json({ error: "Request is not pending." });
    }

    // real password is set during activation
    // (keeps admin from ever choosing/knowing the doctors password)
    const placeholderPassword = crypto.randomBytes(64).toString("hex");

    const newUser = await User.create(
      {
        email: requestLocked.email,
        password: placeholderPassword, // hashed by UserModel hooks before storing
        role: "doctor",
      },
      { transaction }
    );

    // Store activation token hashed so DB leak doesnt expose usable tokens
    const activationToken = crypto.randomBytes(32).toString("hex");
    const activationTokenHash = hashValue(activationToken);
    const activationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await DoctorAccountRequest.update(
      {
        status: "APPROVED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        doctorUserId: newUser.id,
        activationTokenHash,
        activationTokenExpiresAt,
      },
      { where: { id }, transaction }
    );

    await transaction.commit();

    await logAudit(adminId, "DOCTOR_REQUEST_APPROVE", req.ip, {
      requestId: id,
      emailHash,
      licenseHash,
    });

    await logAudit(adminId, "DOCTOR_INVITE_CREATED", req.ip, {
      requestId: id,
      doctorUserId: newUser.id,
      emailHash,
      licenseHash,
      expiresAt: activationTokenExpiresAt.toISOString(),
    });

    await logAudit(adminId, "DOCTOR_ACCOUNT_CREATED", req.ip, {
      doctorUserId: newUser.id,
      emailHash,
      licenseHash,
    });

    // Token returned only once here (doctor uses it to activate + set real password)
    return res.status(200).json({
      message: "Doctor request approved.",
      activationToken,
      doctorUserId: newUser.id,
      requestId: id,
      expiresAt: activationTokenExpiresAt,
    });
  } catch (error: any) {
    await transaction.rollback();
    return res.status(500).json({ error: "Failed to approve request." });
  }
};

// POST /admin/doctor-requests/:id/reject
exports.rejectDoctorRequest = async (req: any, res: any) => {
  const adminId = req.user?.id || null;
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: "Invalid id." });
  }

  const request = await DoctorAccountRequest.findOne({ where: { id } });
  if (!request) {
    return res.status(404).json({ error: "Request not found." });
  }

  if (request.status !== "PENDING") {
    return res.status(409).json({ error: "Request is not pending." });
  }

  const emailHash = getEmailHash(request.email);
  const licenseHash = getLicenseHash(request.licenseNumber);

  try {
    await DoctorAccountRequest.update(
      {
        status: "REJECTED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      { where: { id } }
    );

    await logAudit(adminId, "DOCTOR_REQUEST_REJECT", req.ip, {
      requestId: id,
      emailHash,
      licenseHash,
    });

    return res.status(200).json({ message: "Doctor request rejected." });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to reject request." });
  }
};

// POST /doctor-activation
// Activation token is compared via SHA 256 hash (not stored in plaintext)
exports.activateDoctorAccount = async (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Invalid activation input." });
  }

  const data = matchedData(req, { locations: ["body"], includeOptionals: false });
  const tokenHash = hashValue(data.token);

  try {
    const request = await DoctorAccountRequest.findOne({
      where: { activationTokenHash: tokenHash },
    });

    // Audit token replay attempts without leaking whether token exists to attacker
    if (!request) {
      await logAudit(null, "TOKEN_REPLAY_ATTEMPT", req.ip, { status: "no_match" });
      return res.status(400).json({ error: "Invalid or expired activation token." });
    }

    if (request.status !== "APPROVED") {
      await logAudit(null, "TOKEN_REPLAY_ATTEMPT", req.ip, {
        requestId: request.id,
        status: request.status,
      });
      return res.status(409).json({ error: "Activation not allowed." });
    }

    if (!request.activationTokenExpiresAt || request.activationTokenExpiresAt <= new Date()) {
      await logAudit(null, "ACTIVATION_TOKEN_EXPIRED", req.ip, {
        requestId: request.id,
      });
      return res.status(400).json({ error: "Activation token expired." });
    }

    const user = await User.findOne({ where: { id: request.doctorUserId } });
    if (!user) {
      await logAudit(null, "TOKEN_REPLAY_ATTEMPT", req.ip, {
        requestId: request.id,
        status: "user_missing",
      });
      return res.status(400).json({ error: "Invalid or expired activation token." });
    }

    const transaction = await sequelize.transaction();
    try {
      // Password is stored hashed by model hooks, controller never logs it
      await user.update({ password: data.password }, { transaction });

      // Invalidate token after use to prevent replay
      await DoctorAccountRequest.update(
        { activationTokenHash: null, activationTokenExpiresAt: null },
        { where: { id: request.id }, transaction }
      );

      await transaction.commit();

      await logAudit(user.id, "DOCTOR_ACCOUNT_ACTIVATED", req.ip, {
        requestId: request.id,
      });

      return res.status(200).json({ message: "Doctor account activated." });
    } catch (error: any) {
      await transaction.rollback();
      return res.status(500).json({ error: "Failed to activate account." });
    }
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to activate account." });
  }
};

export {};