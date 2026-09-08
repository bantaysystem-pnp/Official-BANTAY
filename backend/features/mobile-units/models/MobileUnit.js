const pool = require("../../../config/database");

class MobileUnit {
  static async getAll(sortBy) {
    let orderClause = "ORDER BY unit_name ASC";
    if (sortBy === "created_at") orderClause = "ORDER BY created_at DESC";
    else if (sortBy === "created_at_asc") orderClause = "ORDER BY created_at ASC";

    const result = await pool.query(
      `SELECT id, unit_name, is_active, created_at, updated_at
       FROM mobile_units
       ${orderClause}`,
    );
    return result.rows;
  }

  static async getById(id) {
    const result = await pool.query(
      `SELECT id, unit_name, is_active, created_at, updated_at
       FROM mobile_units WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(unitName) {
    const result = await pool.query(
      `INSERT INTO mobile_units (unit_name, is_active)
       VALUES ($1, true)
       RETURNING id, unit_name, is_active, created_at, updated_at`,
      [unitName],
    );
    return result.rows[0];
  }

  // Handles both a full-name edit and an is_active toggle through one
  // dynamic UPDATE — mirrors how the frontend re-uses PATCH /:id for
  // both "Edit" (sends unit_name) and "Remove/Restore" (sends is_active).
  static async update(id, { unit_name, is_active }) {
    const fields = [];
    const params = [];
    let p = 1;

    if (unit_name !== undefined) {
      fields.push(`unit_name = $${p++}`);
      params.push(unit_name);
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${p++}`);
      params.push(is_active);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const result = await pool.query(
      `UPDATE mobile_units SET ${fields.join(", ")}
       WHERE id = $${p}
       RETURNING id, unit_name, is_active, created_at, updated_at`,
      params,
    );
    return result.rows[0] || null;
  }

  static async findByName(unitName) {
    const result = await pool.query(
      `SELECT id, unit_name, is_active FROM mobile_units WHERE LOWER(unit_name) = LOWER($1)`,
      [unitName],
    );
    return result.rows[0] || null;
  }

  // Same find-or-reactivate-or-create pattern as findOrCreateModus /
  // findOrCreateTypeOfOperation — used by bulk import so a typo'd unit
  // name doesn't hard-fail the row.
  static async findOrCreate(unitName) {
    const existing = await this.findByName(unitName);
    if (existing) {
      if (!existing.is_active) {
        const restored = await this.update(existing.id, { is_active: true });
        return { id: restored.id, unit_name: restored.unit_name, created: false, reactivated: true };
      }
      return { id: existing.id, unit_name: existing.unit_name, created: false, reactivated: false };
    }
    const created = await this.create(unitName);
    return { id: created.id, unit_name: created.unit_name, created: true, reactivated: false };
  }
}

module.exports = MobileUnit;