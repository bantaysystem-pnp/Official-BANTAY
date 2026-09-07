const MobileUnit = require("../models/MobileUnit");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");

const getAllMobileUnits = async (req, res) => {
  try {
    const { sort_by } = req.query;
    const units = await MobileUnit.getAll(sort_by);
    res.status(200).json({ success: true, data: units });
  } catch (error) {
    console.error("Get mobile units error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createMobileUnit = async (req, res) => {
  try {
    const trimmed = (req.body.unit_name || "").trim();

    if (!trimmed) {
      return res
        .status(400)
        .json({ success: false, message: "Unit Name is required" });
    }
    if (trimmed.length < 2) {
      return res
        .status(400)
        .json({ success: false, message: "Unit Name must be at least 2 characters" });
    }
    if (trimmed.length > 150) {
      return res
        .status(400)
        .json({ success: false, message: "Unit Name too long (max 150 characters)" });
    }

    const existing = await MobileUnit.findByName(trimmed);

    if (existing && existing.is_active) {
      return res
        .status(409)
        .json({ success: false, message: `"${trimmed}" already exists` });
    }

    if (existing && !existing.is_active) {
      // Name matches a removed (soft-deleted) unit — bring it back instead
      // of blocking, same as how Modus/Type of Operation silently reuse an
      // exact-match row rather than erroring.
      const restored = await MobileUnit.update(existing.id, { is_active: true });

      await logAudit({
        userId: req.user?.user_id,
        username: req.user?.username,
        eventName: "Mobile Unit Restored",
        description: `Restored mobile unit "${trimmed}" via blotter form`,
        action: "UPDATE",
        status: "success",
        source: "Web Portal",
        ipAddress: getClientIp(req),
      });

      return res.status(200).json({
        success: true,
        message: `"${trimmed}" was previously removed — restored it instead.`,
        data: { ...restored, reactivated: true },
      });
    }

    const created = await MobileUnit.create(trimmed);

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Mobile Unit Created",
      description: `Created mobile unit "${trimmed}"`,
      action: "CREATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      message: "Mobile unit created successfully",
      data: { ...created, reactivated: false },
    });
  } catch (error) {
    // Race-condition fallback if two requests slip past findByName at once —
    // the DB's UNIQUE constraint on unit_name is the real guard.
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "That unit name already exists" });
    }
    console.error("Create mobile unit error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateMobileUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { unit_name, is_active } = req.body;

    const existing = await MobileUnit.getById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Mobile unit not found" });
    }

    let trimmedName;
    if (unit_name !== undefined) {
      trimmedName = unit_name.trim();
      if (!trimmedName) {
        return res
          .status(400)
          .json({ success: false, message: "Unit Name is required" });
      }
      if (trimmedName.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Unit Name must be at least 2 characters",
        });
      }
      if (trimmedName.length > 150) {
        return res.status(400).json({
          success: false,
          message: "Unit Name too long (max 150 characters)",
        });
      }

      const dup = await MobileUnit.findByName(trimmedName);
      if (dup && dup.id !== parseInt(id, 10)) {
        return res
          .status(409)
          .json({ success: false, message: `"${trimmedName}" already exists` });
      }
    }

    const updated = await MobileUnit.update(id, {
      unit_name: trimmedName,
      is_active,
    });

    const eventName =
      is_active !== undefined && unit_name === undefined
        ? is_active
          ? "Mobile Unit Restored"
          : "Mobile Unit Removed"
        : "Mobile Unit Updated";

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName,
      description: `${eventName} — ID ${id} ("${updated.unit_name}")`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(200).json({
      success: true,
      message: "Mobile unit updated successfully",
      data: updated,
    });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ success: false, message: "That unit name already exists" });
    }
    console.error("Update mobile unit error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllMobileUnits,
  createMobileUnit,
  updateMobileUnit,
};