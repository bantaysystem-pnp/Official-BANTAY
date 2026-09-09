// backend\features\cases\controllers\casesController.js

const pool = require("../../../config/database");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");

// Small helper — cases_v2 no longer carries its own display identifier
// (no case_number column), so everywhere the old code used case_number for
// notifications/messages, we look up crime_reports_v2.report_number instead.
const getReportNumberForCase = async (caseId) => {
  const result = await pool.query(
    `SELECT cr.report_number
     FROM cases_v2 c
     JOIN crime_reports_v2 cr ON cr.report_id = c.report_id
     WHERE c.id = $1`,
    [caseId],
  );
  return result.rows[0]?.report_number || null;
};

// PATCH /cases/:id/assign — Admin only. Free-text name, no FK to users.
const assignInvestigator = async (req, res) => {
  try {
    const { id } = req.params;
    const raw = req.body.assigned_io_name;
    const nameValue = raw && raw.trim().length > 0 ? raw.trim() : null;

    const caseCheck = await pool.query(
      "SELECT id FROM cases_v2 WHERE id = $1",
      [id],
    );
    if (caseCheck.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    const result = await pool.query(
      `UPDATE cases_v2 SET assigned_io_name = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, assigned_io_name, updated_at`,
      [nameValue, id],
    );

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: nameValue
        ? "Investigator Assigned"
        : "Investigator Unassigned",
      description: nameValue
        ? `Assigned "${nameValue}" to case ID ${id}`
        : `Unassigned investigator from case ID ${id}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    return res.status(200).json({
      success: true,
      message: nameValue
        ? "Investigator assigned successfully"
        : "Investigator unassigned successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Assign investigator error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error assigning investigator" });
  }
};

// PATCH /cases/:id/status — Admin + Investigator
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // "Referred" added — it's a valid cases_v2.status value per the CHECK
    // constraint, even though the old blotter-backed flow never exposed it here.
    const allowed = ["Under Investigation", "Solved", "Cleared"];
    if (!status || !allowed.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });

    const caseResult = await pool.query(
      "SELECT * FROM cases_v2 WHERE id = $1",
      [id],
    );
    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    const result = await pool.query(
      `UPDATE cases_v2
       SET status = $1::varchar,
           priority = CASE WHEN $1::varchar IN ('Solved', 'Cleared') AND priority IS NOT NULL THEN 'Low' ELSE priority END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, report_id, status, priority, updated_at`,
      [status, id],
    );

    const reportNumber = (await getReportNumberForCase(id)) || `Case #${id}`;

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Status Updated",
      description: `Case ID ${id} status has been changed to "${status}"`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    // Notify the assigned investigator (only if someone is assigned)
    const assignedIoId = caseResult.rows[0].assigned_io_id;
    if (assignedIoId && assignedIoId !== req.user.user_id) {
    }

    return res.status(200).json({
      success: true,
      message: "Case status updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update status error:", error);
    res.status(500).json({ success: false, message: "Error updating status" });
  }
};

// GET /cases — All roles, filtered
const getCases = async (req, res) => {
  try {
    const { status, priority, date_from, date_to } = req.query;
    const role = req.user.role;
    const userId = req.user.user_id;

    let whereConditions = ["cr.is_deleted = false"];
    let params = [];
    let paramCount = 1;

    // Role-based filtering
    if (role === "Patrol") {
      return res.status(200).json({ success: true, data: [] });
    } else if (role === "Barangay") {
      // Barangay users can't access Case Management at all
      return res.status(200).json({ success: true, data: [] });
    }

    if (status) {
      whereConditions.push(`c.status = $${paramCount++}`);
      params.push(status);
    }
    if (priority) {
      whereConditions.push(`c.priority = $${paramCount++}`);
      params.push(priority);
    }
    if (date_from) {
      whereConditions.push(`cr.date_time_commission >= $${paramCount++}`);
      params.push(date_from);
    }
    if (date_to) {
      whereConditions.push(
        `cr.date_time_commission < ($${paramCount++}::date + interval '1 day')`,
      );
      params.push(date_to);
    }

    const where = `WHERE ${whereConditions.join(" AND ")}`;

    const result = await pool.query(
      `SELECT c.id, c.status, c.priority, c.updated_at,
    c.assigned_io_name,
    c.suspect_apprehended,
    cr.crime_type,
    cr.place_barangay AS barangay,
    cr.report_number,
    cr.created_at
 FROM cases_v2 c
   INNER JOIN crime_reports_v2 cr ON c.report_id = cr.report_id
${where}
   ORDER BY 
  CASE 
    WHEN c.priority = 'High' AND c.status = 'Under Investigation' THEN 1
    WHEN c.priority = 'Medium' AND c.status = 'Under Investigation' THEN 2
    WHEN c.priority = 'Low' AND c.status = 'Under Investigation' THEN 3
    WHEN c.priority = 'High' AND c.status = 'Cleared' THEN 4
    WHEN c.priority = 'Medium' AND c.status = 'Cleared' THEN 5
    WHEN c.priority = 'Low' AND c.status = 'Cleared' THEN 6
    WHEN c.priority = 'High' AND c.status = 'Solved' THEN 7
    WHEN c.priority = 'Medium' AND c.status = 'Solved' THEN 8
    WHEN c.priority = 'Low' AND c.status = 'Solved' THEN 9
    ELSE 10
  END,
  cr.created_at DESC`,
      params,
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get cases error:", error);
    res.status(500).json({ success: false, message: "Error fetching cases" });
  }
};

// GET /cases/statistics — Admin only
const getStatistics = async (req, res) => {
  try {
    const { date_from, date_to, status, priority } = req.query;
    const conditions = ["cr.is_deleted = false"];
    const params = [];
    let p = 1;
    if (date_from) {
      conditions.push(`cr.date_time_commission >= $${p++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(
        `cr.date_time_commission < ($${p++}::date + interval '1 day')`,
      );
      params.push(date_to);
    }
    if (status) {
      conditions.push(`c.status = $${p++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`c.priority = $${p++}`);
      params.push(priority);
    }
    const where = "WHERE " + conditions.join(" AND ");

    // Seeds define which 2 methods get their own card — first 2 rows by id.
    // Not "top by usage" — fixed to Police Response / Turn over by Barangay
    // per the seed insert order, resolved by name so a rename doesn't break this.
    const seedResult = await pool.query(
      "SELECT method_name FROM suspect_apprehended_methods ORDER BY id ASC LIMIT 2",
    );
    const [method1 = null, method2 = null] = seedResult.rows.map(
      (r) => r.method_name,
    );

    // Params for the two named methods are appended after the filter params.
    const method1Idx = p++;
    params.push(method1);
    const method2Idx = p++;
    params.push(method2);

    const result = await pool.query(
      `SELECT
    COUNT(*) AS total_cases,
    COUNT(*) FILTER (WHERE c.status = 'Under Investigation') AS active_cases,
    COUNT(*) FILTER (WHERE c.status = 'Solved') AS solved_cases,
    COUNT(*) FILTER (WHERE c.status = 'Cleared') AS cleared_cases,
    COUNT(*) FILTER (WHERE c.status = 'Referred') AS referred_cases,
    COUNT(*) FILTER (WHERE c.assigned_io_name IS NULL OR c.assigned_io_name = '') AS unassigned_cases,
    COUNT(*) FILTER (WHERE c.priority = 'High') AS high_priority_cases,
    COUNT(*) FILTER (WHERE c.suspect_apprehended = $${method1Idx}::varchar) AS method1_count,
    COUNT(*) FILTER (WHERE c.suspect_apprehended = $${method2Idx}::varchar) AS method2_count,
    COUNT(*) FILTER (
      WHERE c.suspect_apprehended IS NOT NULL
        AND c.suspect_apprehended NOT IN ($${method1Idx}::varchar, $${method2Idx}::varchar)
    ) AS others_count
   FROM cases_v2 c
   INNER JOIN crime_reports_v2 cr ON c.report_id = cr.report_id
   ${where}`,
      params,
    );

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        total_cases: parseInt(row.total_cases) || 0,
        active_cases: parseInt(row.active_cases) || 0,
        solved_cases: parseInt(row.solved_cases) || 0,
        cleared_cases: parseInt(row.cleared_cases) || 0,
        referred_cases: parseInt(row.referred_cases) || 0,
        unassigned_cases: parseInt(row.unassigned_cases) || 0,
        high_priority_cases: parseInt(row.high_priority_cases) || 0,
        suspect_apprehended_breakdown: [
          { label: method1 || "N/A", count: parseInt(row.method1_count) || 0 },
          { label: method2 || "N/A", count: parseInt(row.method2_count) || 0 },
          { label: "Others", count: parseInt(row.others_count) || 0 },
        ],
      },
    });
  } catch (error) {
    console.error("Statistics error:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching statistics" });
  }
};
// GET /cases/:id — Single case with notes
const getCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user.user_id;

    const caseResult = await pool.query(
      `SELECT c.*, 
          cr.crime_type, cr.place_barangay AS barangay,
          cr.report_number, cr.created_at AS report_created_at
   FROM cases_v2 c
       LEFT JOIN crime_reports_v2 cr ON c.report_id = cr.report_id
       WHERE c.id = $1`,
      [id],
    );

    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    const theCase = caseResult.rows[0];

    if (role === "Barangay") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Get notes
    const isAdmin =
      req.user.role === "Administrator" ||
      req.user.role === "Technical Administrator";
    const notes = await pool.query(
      `SELECT cn.id, cn.note, cn.note_date,
to_char(cn.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
to_char(cn.edited_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS edited_at,
to_char(cn.deleted_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS deleted_at,
          cn.added_by_id,
          CONCAT(u.first_name, ' ', u.last_name) AS added_by_name
   FROM case_notes_v2 cn
   JOIN users u ON cn.added_by_id = u.user_id
   WHERE cn.case_id = $1 ${isAdmin ? "" : "AND cn.deleted_at IS NULL"}
   ORDER BY cn.created_at DESC`,
      [id],
    );

    return res
      .status(200)
      .json({ success: true, data: { ...theCase, notes: notes.rows } });
  } catch (error) {
    console.error("Get case error:", error);
    res.status(500).json({ success: false, message: "Error fetching case" });
  }
};

// POST /cases/:id/notes — Admin + Investigator
const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, note_date } = req.body;
    if (!note || note.trim().length < 3)
      return res.status(400).json({
        success: false,
        message: "Note must be at least 3 characters",
      });

    const caseResult = await pool.query(
      "SELECT * FROM cases_v2 WHERE id = $1",
      [id],
    );
    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    const result = await pool.query(
      `INSERT INTO case_notes_v2 (case_id, note, added_by_id, note_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, note.trim(), req.user.user_id, note_date || new Date()],
    );

    const user = await pool.query(
      "SELECT CONCAT(first_name, ' ', last_name) AS name FROM users WHERE user_id = $1",
      [req.user.user_id],
    );

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Note Added",
      description: `Added note to case ID ${id}`,
      action: "CREATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    const reportNumber = (await getReportNumberForCase(id)) || `Case #${id}`;
    const assignedIoId = caseResult.rows[0].assigned_io_id;

    // Notify investigator if someone else added the note
    if (assignedIoId && assignedIoId !== req.user.user_id) {
    }
    // Notify admins if investigator added the note
    if (req.user.role === "Investigator") {
    }
    return res.status(201).json({
      success: true,
      message: "Note added",
      data: { ...result.rows[0], added_by_name: user.rows[0].name },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error adding note" });
  }
};

const updatePriority = async (req, res) => {
  try {
    const { id } = req.params;
    // "" / null / undefined = clear the priority (no card-level priority set)
    const priority =
      req.body.priority === "" ||
      req.body.priority === null ||
      req.body.priority === undefined
        ? null
        : req.body.priority;
    if (priority !== null && !["Low", "Medium", "High"].includes(priority))
      return res
        .status(400)
        .json({ success: false, message: "Invalid priority" });

    const caseResult = await pool.query(
      "SELECT * FROM cases_v2 WHERE id = $1",
      [id],
    );
    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    const result = await pool.query(
      "UPDATE cases_v2 SET priority = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [priority, id],
    );
    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Priority Updated",
      description: priority
        ? `Updated case ID ${id} priority to "${priority}"`
        : `Cleared priority for case ID ${id}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    const reportNumber = (await getReportNumberForCase(id)) || `Case #${id}`;

    const assignedIoId = caseResult.rows[0].assigned_io_id;
    if (assignedIoId && assignedIoId !== req.user.user_id) {
    }
    if (req.user.role === "Investigator") {
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /cases/:id/suspect-apprehended
const updateSuspectApprehended = async (req, res) => {
  try {
    const { id } = req.params;
    const raw = req.body.suspect_apprehended;
    const value = raw && raw.trim().length > 0 ? raw.trim() : null;

    const caseResult = await pool.query("SELECT id FROM cases_v2 WHERE id = $1", [id]);
    if (caseResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "Case not found" });

    const result = await pool.query(
      "UPDATE cases_v2 SET suspect_apprehended = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [value, id],
    );

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Suspect Apprehended Updated",
      description: value
        ? `Set case ID ${id} suspect apprehended to "${value}"`
        : `Cleared suspect apprehended for case ID ${id}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Update suspect apprehended error:", error);
    res.status(500).json({ success: false, message: "Error updating suspect apprehended" });
  }
};

const editNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const { note, note_date } = req.body;
    if (!note || note.trim().length < 3)
      return res
        .status(400)
        .json({ success: false, message: "Note too short" });

    const existing = await pool.query(
      "SELECT * FROM case_notes_v2 WHERE id = $1 AND deleted_at IS NULL",
      [noteId],
    );
    if (existing.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });

    const result = await pool.query(
      `UPDATE case_notes_v2 SET note = $1, edited_at = NOW()
   WHERE id = $2 RETURNING *`,
      [note.trim(), noteId],
    );
    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Note Edited",
      description: `Edited note ID ${noteId}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const existing = await pool.query(
      "SELECT * FROM case_notes_v2 WHERE id = $1 AND deleted_at IS NULL",
      [noteId],
    );
    if (existing.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });

    await pool.query(
      "UPDATE case_notes_v2 SET deleted_at = NOW() WHERE id = $1",
      [noteId],
    );

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Note Deleted",
      description: `Soft-deleted note ID ${noteId}`,
      action: "DELETE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Note deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const restoreNote = async (req, res) => {
  try {
    const { noteId } = req.params;
    const existing = await pool.query(
      "SELECT * FROM case_notes_v2 WHERE id = $1 AND deleted_at IS NOT NULL",
      [noteId],
    );
    if (existing.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Note not found or not deleted" });

    await pool.query(
      "UPDATE case_notes_v2 SET deleted_at = NULL WHERE id = $1",
      [noteId],
    );
    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Note Restored",
      description: `Restored note ID ${noteId}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, message: "Note restored" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  assignInvestigator,
  updateStatus,
  updatePriority,
  updateSuspectApprehended,
  getCases,
  getCaseById,
  addNote,
  editNote,
  deleteNote,
  restoreNote,
  getStatistics,
};
