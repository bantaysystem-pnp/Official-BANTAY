// backend\features\type-of-operation\typeOfOperationController.js

const pool = require("../../../config/database");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");

// GET all — supports sort_by like modus (created_at / created_at_asc / default alpha)
const getAllTypeOfOperation = async (req, res) => {
  const { sort_by } = req.query;
  let orderBy;
  if (sort_by === "created_at") orderBy = "created_at DESC";
  else if (sort_by === "created_at_asc") orderBy = "created_at ASC";
  else orderBy = "operation_name ASC";

  const result = await pool.query(
    `SELECT * FROM type_of_operation_reference ORDER BY ${orderBy}`,
  );
  res.json({ success: true, data: result.rows });
};

const getTypeOfOperationById = async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM type_of_operation_reference WHERE id = $1`,
    [req.params.id],
  );
  if (result.rows.length === 0)
    return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: result.rows[0] });
};

const createTypeOfOperation = async (req, res) => {
  const trimmed = (req.body.operation_name || "").trim();
  if (!trimmed)
    return res.status(400).json({ success: false, message: "operation_name is required" });
  if (trimmed.length > 100)
    return res.status(400).json({ success: false, message: "operation_name too long (max 100 characters)" });

  // matches the DB's unique_type_of_operation constraint, case-insensitively
  const dup = await pool.query(
    `SELECT id, is_active FROM type_of_operation_reference WHERE LOWER(operation_name) = LOWER($1)`,
    [trimmed],
  );

  if (dup.rows.length > 0 && dup.rows[0].is_active) {
    return res.status(400).json({ success: false, message: "This Type of Operation already exists" });
  }

  if (dup.rows.length > 0 && !dup.rows[0].is_active) {
    // Name matches a removed (deactivated) type — reactivate it instead
    // of blocking, same pattern as Mobile Unit.
    const restored = await pool.query(
      `UPDATE type_of_operation_reference SET is_active = true, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [dup.rows[0].id],
    );

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Type of Operation Restored",
      description: `Restored Type of Operation "${trimmed}" via reuse of removed name`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    return res.status(200).json({
      success: true,
      message: `"${trimmed}" was previously removed — restored it instead.`,
      data: { ...restored.rows[0], reactivated: true },
    });
  }

  const result = await pool.query(
    `INSERT INTO type_of_operation_reference (operation_name, is_active)
     VALUES ($1, true) RETURNING *`,
    [trimmed],
  );

  await logAudit({
    userId: req.user?.user_id,
    username: req.user?.username,
    eventName: "Type of Operation Created",
    description: `Created Type of Operation "${trimmed}"`,
    action: "CREATE",
    status: "success",
    source: "Web Portal",
    ipAddress: getClientIp(req),
  });

  res.status(201).json({ success: true, data: { ...result.rows[0], reactivated: false } });
};

// PATCH — edit name OR toggle is_active (remove/restore), same COALESCE pattern as modus
const updateTypeOfOperation = async (req, res) => {
  const { operation_name, is_active } = req.body;

  if (operation_name !== undefined) {
    const trimmed = operation_name.trim();
    if (!trimmed)
      return res.status(400).json({ success: false, message: "operation_name is required" });
    if (trimmed.length > 100)
      return res.status(400).json({ success: false, message: "operation_name too long (max 100 characters)" });

    // exclude the row being edited so it can keep its own name
    const dup = await pool.query(
      `SELECT id, is_active FROM type_of_operation_reference WHERE LOWER(operation_name) = LOWER($1) AND id != $2`,
      [trimmed, req.params.id],
    );
    if (dup.rows.length > 0) {
      const message = dup.rows[0].is_active
        ? "This Type of Operation already exists"
        : `"${trimmed}" was previously removed. Restore it from the removed list.`;
      return res.status(400).json({ success: false, message });
    }
  }

  const result = await pool.query(
    `UPDATE type_of_operation_reference
     SET operation_name = COALESCE($1, operation_name),
         is_active      = COALESCE($2, is_active),
         updated_at     = NOW()
     WHERE id = $3
     RETURNING *`,
    [
      operation_name ? operation_name.trim() : null,
      is_active !== undefined ? is_active : null,
      req.params.id,
    ],
  );

  if (result.rows.length === 0)
    return res.status(404).json({ success: false, message: "Not found" });

  const updated = result.rows[0];

  await logAudit({
    userId: req.user?.user_id,
    username: req.user?.username,
    eventName:
      is_active === false ? "Type of Operation Deactivated"
      : is_active === true ? "Type of Operation Restored"
      : "Type of Operation Updated",
    description: `Changes made with Type of Operation ID ${updated.id}: ${updated.operation_name}`,
    action: "UPDATE",
    status: "success",
    source: "Web Portal",
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, data: updated });
};

module.exports = { getAllTypeOfOperation, getTypeOfOperationById, createTypeOfOperation, updateTypeOfOperation };