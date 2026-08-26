const pool = require("../../../config/database");

class CrimeReportV2 {
  static async generateReportNumber(incidentDate) {
    const year = incidentDate
      ? new Date(incidentDate).getFullYear()
      : new Date().getFullYear();

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM crime_reports_v2
       WHERE EXTRACT(YEAR FROM created_at) = $1`,
      [year],
    );
    const count = parseInt(result.rows[0].count) + 1;
    return `CR-${year}-${count.toString().padStart(4, "0")}`;
  }

  static async create(reportData, createdBy) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reportNumber =
        reportData.report_number && reportData.report_number.trim()
          ? reportData.report_number.trim()
          : await this.generateReportNumber(reportData.date_time_commission);

      const reportResult = await client.query(
        `INSERT INTO crime_reports_v2 (
          report_number, crime_type, stage_of_felony, index_type,
          modus_reference_id, date_time_commission, date_time_reported,
          place_barangay, type_of_place, lat, lng, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING report_id`,
        [
          reportNumber,
          reportData.crime_type,
          reportData.stage_of_felony || null,
          "Index",
          reportData.modus_reference_id || null,
          reportData.date_time_commission,
          reportData.date_time_reported,
          reportData.place_barangay,
          reportData.type_of_place || null,
          reportData.lat || null,
          reportData.lng || null,
          createdBy,
        ],
      );

      const reportId = reportResult.rows[0].report_id;

      // Auto-create paired case — priority logic same rules as v1's autoCreateCase
      const highCrimes = [
        "murder",
        "homicide",
        "rape",
        "special complex crime",
      ];
      const mediumCrimes = ["robbery", "carnapping - mc", "carnapping - mv"];
      const crimeTypeLower = (reportData.crime_type || "").toLowerCase().trim();
      let priority = "Low";
      if (highCrimes.includes(crimeTypeLower)) priority = "High";
      else if (mediumCrimes.includes(crimeTypeLower)) priority = "Medium";

      await client.query(
        `INSERT INTO cases_v2 (report_id, status, priority)
         VALUES ($1, 'Under Investigation', $2)`,
        [reportId, priority],
      );

      await client.query("COMMIT");
      return { report_id: reportId, report_number: reportNumber };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  static async getAll(filters = {}) {
    let query = `
      SELECT
        cr.report_id, cr.report_number, cr.crime_type, cr.stage_of_felony,
        cr.index_type, cr.place_barangay,
        cr.type_of_place, cr.lat, cr.lng,
        TO_CHAR(cr.date_time_commission, 'YYYY-MM-DD"T"HH24:MI') as date_time_commission,
        TO_CHAR(cr.date_time_reported, 'YYYY-MM-DD"T"HH24:MI') as date_time_reported,
        cmr.modus_name,
        c.id as case_id, c.status, c.priority, c.assigned_io_id
      FROM crime_reports_v2 cr
      LEFT JOIN crime_modus_reference cmr ON cmr.id = cr.modus_reference_id
      LEFT JOIN cases_v2 c ON c.report_id = cr.report_id
      WHERE cr.is_deleted = false
    `;
    const params = [];
    let p = 1;

    if (filters.search) {
      query += ` AND cr.report_number ILIKE $${p++}`;
      params.push(`%${filters.search.trim()}%`);
    }
    if (filters.crime_type) {
      query += ` AND cr.crime_type = $${p++}`;
      params.push(filters.crime_type);
    }
    if (filters.status) {
      query += ` AND c.status = $${p++}`;
      params.push(filters.status);
    }
    if (filters.barangay) {
      query += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
      const { expandBarangays } = require("../../../shared/utils/barangays");
      params.push(expandBarangays([filters.barangay.toUpperCase()]));
    }
    if (filters.date_from) {
      query += ` AND cr.date_time_reported >= $${p++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      query += ` AND DATE(cr.date_time_reported) <= DATE($${p++})`;
      params.push(filters.date_to);
    }

    query += ` ORDER BY cr.date_time_reported DESC`;
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async getById(reportId) {
    const result = await pool.query(
      `SELECT
        cr.report_id, cr.report_number, cr.crime_type, cr.stage_of_felony,
        cr.index_type, cr.modus_reference_id,
        cr.place_barangay, cr.type_of_place, cr.lat, cr.lng,
        cr.created_by, cr.created_at, cr.updated_at, cr.is_deleted, cr.deleted_at,
        TO_CHAR(cr.date_time_commission, 'YYYY-MM-DD"T"HH24:MI') as date_time_commission,
        TO_CHAR(cr.date_time_reported, 'YYYY-MM-DD"T"HH24:MI') as date_time_reported,
        cmr.modus_name,
        c.id as case_id, c.status, c.priority, c.assigned_io_id, c.updated_at as case_updated_at
       FROM crime_reports_v2 cr
       LEFT JOIN crime_modus_reference cmr ON cmr.id = cr.modus_reference_id
       LEFT JOIN cases_v2 c ON c.report_id = cr.report_id
       WHERE cr.report_id = $1 AND cr.is_deleted = false`,
      [reportId],
    );
    return result.rows[0] || null;
  }

  static async update(reportId, reportData) {
    const result = await pool.query(
      `UPDATE crime_reports_v2 SET
        report_number = $1, crime_type = $2, stage_of_felony = $3, index_type = $4,
        modus_reference_id = $5, date_time_commission = $6, date_time_reported = $7,
        place_barangay = $8, type_of_place = $9, lat = $10, lng = $11,
        updated_at = CURRENT_TIMESTAMP
       WHERE report_id = $12 AND is_deleted = false
       RETURNING *`,
      [
        reportData.report_number && reportData.report_number.trim()
          ? reportData.report_number.trim()
          : null,
        reportData.crime_type,
        reportData.stage_of_felony || null,
        "Index",
        reportData.modus_reference_id || null,
        reportData.date_time_commission,
        reportData.date_time_reported,
        reportData.place_barangay,
        reportData.type_of_place || null,
        reportData.lat || null,
        reportData.lng || null,
        reportId,
      ],
    );
    return result.rows[0] || null;
  }

  static async softDelete(reportId) {
    const result = await pool.query(
      `UPDATE crime_reports_v2 SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP
       WHERE report_id = $1 RETURNING *`,
      [reportId],
    );
    return result.rows[0] || null;
  }

  static async restore(reportId) {
    const result = await pool.query(
      `UPDATE crime_reports_v2 SET is_deleted = false, deleted_at = NULL
       WHERE report_id = $1 RETURNING *`,
      [reportId],
    );
    return result.rows[0] || null;
  }

  static async getDeleted() {
    const result = await pool.query(
      `SELECT * FROM crime_reports_v2 WHERE is_deleted = true ORDER BY deleted_at DESC`,
    );
    return result.rows;
  }

  static async getModusByCrimeType(crimeType) {
    const result = await pool.query(
      `SELECT id, modus_name, description
       FROM crime_modus_reference
       WHERE UPPER(TRIM(crime_type)) = UPPER(TRIM($1)) AND is_active = true
       ORDER BY modus_name ASC`,
      [crimeType],
    );
    return result.rows;
  }

  static async setCaseStatus(reportId, status) {
    const VALID = ["Under Investigation", "Solved", "Cleared", "Referred"];
    if (!VALID.includes(status)) return null;
    const result = await pool.query(
      `UPDATE cases_v2 SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE report_id = $2 RETURNING *`,
      [status, reportId],
    );
    return result.rows[0] || null;
  }

  static async findOrCreateModus(crimeType, modusName) {
    const existing = await pool.query(
      `SELECT id FROM crime_modus_reference
       WHERE UPPER(crime_type) = UPPER($1) AND LOWER(modus_name) = LOWER($2)`,
      [crimeType, modusName],
    );
    if (existing.rows.length > 0) {
      return { id: existing.rows[0].id, created: false };
    }
    const inserted = await pool.query(
      `INSERT INTO crime_modus_reference (crime_type, modus_name, is_active)
       VALUES ($1, $2, true)
       RETURNING id`,
      [crimeType.toUpperCase(), modusName],
    );
    return { id: inserted.rows[0].id, created: true };
  }
}

module.exports = CrimeReportV2;
