const pool = require("../../../config/database");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");

// GET /suspect-apprehended-methods?includeInactive=true
const getMethods = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const result = await pool.query(
      `SELECT id, method_name, is_active, created_at
       FROM suspect_apprehended_methods
       ${includeInactive ? "" : "WHERE is_active = true"}
       ORDER BY method_name ASC`,
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get suspect apprehended methods error:", error);
    res.status(500).json({ success: false, message: "Error fetching methods" });
  }
};

// POST /suspect-apprehended-methods — dedupe case-insensitively, reactivate if soft-deleted
const createMethod = async (req, res) => {
  try {
    const raw = req.body.method_name;
    const name = raw && raw.trim().length > 0 ? raw.trim() : null;
    if (!name || name.length < 2)
      return res
        .status(400)
        .json({ success: false, message: "Method name is required" });

    const existing = await pool.query(
      "SELECT * FROM suspect_apprehended_methods WHERE LOWER(method_name) = LOWER($1)",
      [name],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.is_active) {
        return res.status(200).json({
          success: true,
          data: { id: row.id, method_name: row.method_name, created: false },
        });
      }
      // Soft-deleted duplicate — reactivate instead of erroring
      const reactivated = await pool.query(
        "UPDATE suspect_apprehended_methods SET is_active = true WHERE id = $1 RETURNING *",
        [row.id],
      );
      await logAudit({
        userId: req.user?.user_id,
        username: req.user?.username,
        eventName: "Suspect Apprehended Method Restored",
        description: `Reactivated "${name}" via create`,
        action: "UPDATE",
        status: "success",
        source: "Web Portal",
        ipAddress: getClientIp(req),
      });
      return res.status(200).json({
        success: true,
        data: {
          id: reactivated.rows[0].id,
          method_name: reactivated.rows[0].method_name,
          reactivated: true,
        },
      });
    }

    const result = await pool.query(
      "INSERT INTO suspect_apprehended_methods (method_name) VALUES ($1) RETURNING *",
      [name],
    );
    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Suspect Apprehended Method Added",
      description: `Added "${name}"`,
      action: "CREATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.status(201).json({
      success: true,
      data: { id: result.rows[0].id, method_name: result.rows[0].method_name, created: true },
    });
  } catch (error) {
    console.error("Create suspect apprehended method error:", error);
    res.status(500).json({ success: false, message: "Error creating method" });
  }
};

// PATCH /suspect-apprehended-methods/:id — rename
const updateMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const raw = req.body.method_name;
    const name = raw && raw.trim().length > 0 ? raw.trim() : null;
    if (!name || name.length < 2)
      return res
        .status(400)
        .json({ success: false, message: "Method name is required" });

    const dupe = await pool.query(
      "SELECT id FROM suspect_apprehended_methods WHERE LOWER(method_name) = LOWER($1) AND id != $2",
      [name, id],
    );
    if (dupe.rows.length > 0)
      return res
        .status(400)
        .json({ success: false, message: "That name already exists" });

    const result = await pool.query(
      "UPDATE suspect_apprehended_methods SET method_name = $1 WHERE id = $2 RETURNING *",
      [name, id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Method not found" });

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Suspect Apprehended Method Renamed",
      description: `Renamed method ID ${id} to "${name}"`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Update suspect apprehended method error:", error);
    res.status(500).json({ success: false, message: "Error updating method" });
  }
};

// PATCH /suspect-apprehended-methods/:id/deactivate
const deactivateMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE suspect_apprehended_methods SET is_active = false WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Method not found" });

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Suspect Apprehended Method Deactivated",
      description: `Deactivated "${result.rows[0].method_name}"`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.status(200).json({ success: true, message: "Method deactivated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deactivating method" });
  }
};

// PATCH /suspect-apprehended-methods/:id/restore
const restoreMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE suspect_apprehended_methods SET is_active = true WHERE id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: "Method not found" });

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Suspect Apprehended Method Restored",
      description: `Restored "${result.rows[0].method_name}"`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.status(200).json({ success: true, message: "Method restored" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error restoring method" });
  }
};

module.exports = { getMethods, createMethod, updateMethod, deactivateMethod, restoreMethod };