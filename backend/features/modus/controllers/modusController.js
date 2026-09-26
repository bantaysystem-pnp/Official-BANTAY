// backend\features\modus\controllers\modusController.js
const pool = require("../../../config/database");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");

const INDEX_CRIMES = [
  "MURDER",
  "HOMICIDE",
  "PHYSICAL INJURIES",
  "RAPE",
  "ROBBERY",
  "THEFT",
  "CARNAPPING - MC",
  "CARNAPPING - MV",
  "SPECIAL COMPLEX CRIME",
];

// GET all modus
const getAllModus = async (req, res) => {
  const { sort_by } = req.query;

  let orderBy;
  if (sort_by === "created_at") {
    orderBy = "created_at DESC"; // Newest first
  } else if (sort_by === "created_at_asc") {
    orderBy = "created_at ASC"; // Oldest first
  } else {
    orderBy = "crime_type, modus_name"; // Default: alphabetical
  }

  const result = await pool.query(
    `SELECT * FROM crime_modus_reference ORDER BY ${orderBy}`,
  );
  res.json({ success: true, data: result.rows });
};

// GET one modus
const getModusById = async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM crime_modus_reference WHERE id = $1`,
    [req.params.id],
  );
  if (result.rows.length === 0)
    return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: result.rows[0] });
};

// POST create
const createModus = async (req, res) => {
  const { crime_type, modus_name, description } = req.body;

  if (!crime_type || !modus_name)
    return res.status(400).json({
      success: false,
      message: "crime_type and modus_name are required",
    });

  if (!INDEX_CRIMES.includes(crime_type.toUpperCase()))
    return res
      .status(400)
      .json({ success: false, message: "Invalid crime type" });

  const dup = await pool.query(
    `SELECT id, is_active FROM crime_modus_reference WHERE UPPER(crime_type) = $1 AND LOWER(modus_name) = LOWER($2)`,
    [crime_type.toUpperCase(), modus_name],
  );

  if (dup.rows.length > 0 && dup.rows[0].is_active) {
    return res.status(400).json({
      success: false,
      message: "Modus already exists for this crime type",
    });
  }

  if (dup.rows.length > 0 && !dup.rows[0].is_active) {
    // Name matches a removed (deactivated) modus — reactivate it and
    // overwrite the description with what was just submitted, since the
    // person is re-adding this modus with fresh info, not reviving the old row as-is.
    const restored = await pool.query(
      `UPDATE crime_modus_reference
       SET is_active = true, description = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [description || null, dup.rows[0].id],
    );

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Modus Restored",
      description: `Restored modus "${modus_name}" for ${crime_type.toUpperCase()} via reuse of removed name`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    return res.status(200).json({
      success: true,
      message: `"${modus_name}" was previously removed — restored it with the new description.`,
      data: { ...restored.rows[0], reactivated: true },
    });
  }

  const result = await pool.query(
    `INSERT INTO crime_modus_reference (crime_type, modus_name, description, is_active)
     VALUES ($1, $2, $3, true) RETURNING *`,
    [crime_type.toUpperCase(), modus_name, description || null],
  );

  await logAudit({
    userId: req.user?.user_id,
    username: req.user?.username,
    eventName: "Modus Created",
    description: `Created modus "${modus_name}" for ${crime_type.toUpperCase()}`,
    action: "CREATE",
    status: "success",
    source: "Web Portal",
    ipAddress: getClientIp(req),
  });

  res.status(201).json({ success: true, data: { ...result.rows[0], reactivated: false } });
};

// PATCH update (edit fields or toggle is_active for soft remove/restore)
const updateModus = async (req, res) => {
  const { crime_type, modus_name, description, is_active } = req.body;

  if (crime_type && !INDEX_CRIMES.includes(crime_type.toUpperCase()))
    return res.status(400).json({ success: false, message: "Invalid crime type" });

  // dup check only matters if either name or crime_type is actually being changed —
  // pull the current row first so we know what to compare against
  if (modus_name !== undefined || crime_type !== undefined) {
    const current = await pool.query(
      `SELECT crime_type, modus_name FROM crime_modus_reference WHERE id = $1`,
      [req.params.id],
    );
    if (current.rows.length === 0)
      return res.status(404).json({ success: false, message: "Not found" });

    const effectiveCrimeType = crime_type ? crime_type.toUpperCase() : current.rows[0].crime_type;
    const effectiveModusName = modus_name || current.rows[0].modus_name;

    const dup = await pool.query(
      `SELECT id, is_active FROM crime_modus_reference WHERE UPPER(crime_type) = $1 AND LOWER(modus_name) = LOWER($2) AND id != $3`,
      [effectiveCrimeType, effectiveModusName, req.params.id],
    );
    if (dup.rows.length > 0) {
      const message = dup.rows[0].is_active
        ? "Modus already exists for this crime type"
        : `"${effectiveModusName}" was previously removed for this crime type. Restore it from the removed list.`;
      return res.status(400).json({ success: false, message });
    }
  }

  let result;
  try {
    result = await pool.query(
      `UPDATE crime_modus_reference
       SET
         crime_type  = COALESCE($1, crime_type),
         modus_name  = COALESCE($2, modus_name),
         description = COALESCE($3, description),
         is_active   = COALESCE($4, is_active),
         updated_at  = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        crime_type ? crime_type.toUpperCase() : null,
        modus_name || null,
        description !== undefined ? description : null,
        is_active !== undefined ? is_active : null,
        req.params.id,
      ],
    );
  } catch (err) {
    if (err.code === "23505") // unique_violation — race condition slipped past the check above
      return res.status(400).json({
        success: false,
        message: "Modus already exists for this crime type",
      });
    throw err;
  }

  if (result.rows.length === 0)
    return res.status(404).json({ success: false, message: "Not found" });

  const updated = result.rows[0];

  await logAudit({
    userId: req.user?.user_id,
    username: req.user?.username,
    eventName:
      is_active === false
        ? "Modus Deactivated"
        : is_active === true
          ? "Modus Restored"
          : "Modus Updated",
    description: `Changes made with Modus ID ${updated.id}: ${updated.modus_name}  (${updated.crime_type})`,
    action: "UPDATE",
    status: "success",
    source: "Web Portal",
    ipAddress: getClientIp(req),
  });

  res.json({ success: true, data: updated });
};

// DELETE (hard delete — blocked if used in reports)

module.exports = { getAllModus, getModusById, createModus, updateModus };
