const express = require("express");
const router = express.Router();
const { authenticateToken, authorizeRoles } = require("../middleware/AuthMiddleware");
const { Favourite } = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

const isSafeName = (value: any) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 255) return false;

  // allow letters/numbers/spaces and common food/med punctuation
  // avoids control chars + reduces injection
  const re = /^[a-zA-Z0-9\s.,'()\-+\/&:%]+$/;
  return re.test(trimmed);
};

const isSafeExternalId = (value: any) => {
  // externalId is optional because manual favourites may not have one
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > 128) return false;

  // typical API ids / barcodes
  const re = /^[a-zA-Z0-9:_\-.]+$/;
  return re.test(value);
};

const isValidType = (value: any) => value === "FOOD" || value === "MEDICATION";

const isValidSource = (value: any) => {
  // source is optional because some favourites can be user entered
  if (value === null || value === undefined || value === "") return true;
  const allowed = ["NUTRITIONIX", "OPENFOODFACTS", "OPENFDA", "DAILYMED", "MANUAL"];
  return allowed.includes(value);
};

// POST /favourites
// Patient only add favourite for food or medication
router.post(
  "/",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    try {
      const userId = req.user.id; // favourites are always scoped to the authenticated user (prevents cross account access)

      const { type, name, externalId, source } = req.body;

      // lightweight validation here keeps API predictable + blocks bad input early
      if (!isValidType(type)) {
        return res.status(400).json({ error: "Invalid type. Use FOOD or MEDICATION." });
      }

      if (!isSafeName(name)) {
        return res.status(400).json({ error: "Invalid name (length/charset)." });
      }

      if (!isSafeExternalId(externalId)) {
        return res.status(400).json({ error: "Invalid externalId (length/charset)." });
      }

      if (!isValidSource(source)) {
        return res.status(400).json({ error: "Invalid source." });
      }

      // Duplicate prevention per-user (same type + name + externalId)
      const existing = await Favourite.findOne({
        where: {
          userId,
          type,
          name: name.trim(),
          externalId: externalId ? externalId : null,
        },
      });

      if (existing) {
        // audit includes outcome so i can spot abuse/replay attempts without leaking details to the client
        await logAudit(userId, "FAVOURITE_ADD", req.ip, {
          status: "duplicate",
          type,
        });

        return res.status(409).json({ error: "Favourite already exists." });
      }

      const created = await Favourite.create({
        userId,
        type,
        name: name.trim(),
        externalId: externalId ? externalId : null,
        source: source ? source : null,
      });

      await logAudit(userId, "FAVOURITE_ADD", req.ip, {
        status: "success",
        favouriteId: created.id,
        type,
      });

      return res.status(201).json({
        id: created.id,
        type: created.type,
        name: created.name,
        externalId: created.externalId,
        source: created.source,
        createdAt: created.createdAt,
      });
    } catch (error: any) {
      await logAudit(req.user?.id ?? null, "FAVOURITE_ADD", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to add favourite." });
    }
  }
);

// GET /favourites?type=FOOD|MEDICATION
// Patient only list favourites 
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const type = req.query.type;

      const where: any = { userId }; //user isolation in query itself enfroced

      if (type !== undefined) {
        if (!isValidType(type)) {
          return res.status(400).json({ error: "Invalid type filter. Use FOOD or MEDICATION." });
        }
        where.type = type;
      }

      const favourites = await Favourite.findAll({
        where,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "type", "name", "externalId", "source", "createdAt"],
      });

      await logAudit(userId, "FAVOURITE_LIST", req.ip, {
        status: "success",
        typeFilter: type ? type : "ALL",
        count: favourites.length,
      });

      return res.json({ favourites });
    } catch (error: any) {
      await logAudit(req.user?.id ?? null, "FAVOURITE_LIST", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to list favourites." });
    }
  }
);

// DELETE /favourites/:id
// Patient only delete a favourite (must belong to req.user.id)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["patient"]),
  async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const id = parseInt(req.params.id, 10);

      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid favourite id." });
      }

      const fav = await Favourite.findOne({
        where: { id, userId }, // strict user isolation (prevents deleting another user's favourite)
        attributes: ["id", "type"],
      });

      if (!fav) {
        await logAudit(userId, "FAVOURITE_DELETE", req.ip, {
          status: "not_found",
          favouriteId: id,
        });

        return res.status(404).json({ error: "Favourite not found." });
      }

      await Favourite.destroy({ where: { id, userId } });

      await logAudit(userId, "FAVOURITE_DELETE", req.ip, {
        status: "success",
        favouriteId: id,
        type: fav.type,
      });

      return res.json({ message: "Favourite deleted." });
    } catch (error: any) {
      await logAudit(req.user?.id ?? null, "FAVOURITE_DELETE", req.ip, {
        status: "error",
      });

      return res.status(500).json({ error: "Failed to delete favourite." });
    }
  }
);

module.exports = router;

export {};
