// backend\features\cases\controllers\casesController.js

const pool = require("../../../config/database");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");
const {
  createNotification,
  notifyAllByRole,
} = require("../../notifications/notificationService");

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

// PATCH /cases/:id/assign — Admin only
const assignInvestigator = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_io_id } = req.body;

    const caseCheck = await pool.query("SELECT id FROM cases_v2 WHERE id = $1", [
      id,
    ]);
    if (caseCheck.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    // Allow unassigning by passing null or empty string
    if (!assigned_io_id || assigned_io_id === "") {
      const result = await pool.query(
        `UPDATE cases_v2 SET assigned_io_id = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING id, assigned_io_id, updated_at`,
        [id],
      );

      await logAudit({
        userId: req.user?.user_id,
        username: req.user?.username,
        eventName: "Investigator Unassigned",
        description: `Unassigned investigator from case ID ${id}`,
        action: "UPDATE",
        status: "success",
        source: "Web Portal",
        ipAddress: getClientIp(req),
      });
      return res.status(200).json({
        success: true,
        message: "Investigator unassigned successfully",
        data: { ...result.rows[0], assigned_io_name: null },
      });
    }

    const user = await pool.query(
      `SELECT u.user_id, u.first_name, u.last_name, u.status, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id WHERE u.user_id = $1`,
      [assigned_io_id],
    );
    if (user.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (user.rows[0].role_name !== "Investigator")
      return res.status(400).json({
        success: false,
        message: "Selected user is not an Investigator",
      });
    if (user.rows[0].status === "locked")
      return res
        .status(400)
        .json({ success: false, message: "Cannot assign a locked account" });

    const result = await pool.query(
      `UPDATE cases_v2 SET assigned_io_id = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, assigned_io_id, updated_at`,
      [assigned_io_id, id],
    );

    const reportNumber = (await getReportNumberForCase(id)) || `Case #${id}`;

    const io = user.rows[0];
    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Investigator Assigned",
      description: `Assigned ${io.first_name} ${io.last_name} to case ID ${id}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });
    await createNotification({
      recipientId: assigned_io_id,
      senderId: req.user.user_id,
      senderName: req.user.username,
      type: "CASE_ASSIGNED",
      title: "Case Assigned to You",
      message: `You have been assigned to ${reportNumber}`,
      linkTo: "/case-management",
    });
    return res.status(200).json({
      success: true,
      message: "Investigator assigned successfully",
      data: {
        ...result.rows[0],
        assigned_io_name: `${io.first_name} ${io.last_name}`,
      },
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
    const allowed = ["Under Investigation", "Solved", "Cleared", "Referred"];
    if (!status || !allowed.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });

    const caseResult = await pool.query("SELECT * FROM cases_v2 WHERE id = $1", [
      id,
    ]);
    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    if (
      req.user.role === "Investigator" &&
      caseResult.rows[0].assigned_io_id !== req.user.user_id
    ) {
      return res
        .status(403)
        .json({ success: false, message: "You are not assigned to this case" });
    }

    const result = await pool.query(
      `UPDATE cases_v2
       SET status = $1::varchar,
           priority = CASE WHEN $1::varchar IN ('Solved', 'Cleared') THEN 'Low' ELSE priority END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, report_id, status, priority, updated_at`,
      [status, id],
    );

    const reportNumber =
      (await getReportNumberForCase(id)) || `Case #${id}`;

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
      await createNotification({
        recipientId: assignedIoId,
        senderId: req.user.user_id,
        senderName: req.user.username,
        type: "CASE_ASSIGNED",
        title: "Case Status Updated",
        message: `${reportNumber} status changed to "${status}"`,
        linkTo: "/case-management",
      });
    }
    // Notify admins only when investigator changes it (exclude self)
    if (req.user.role === "Investigator") {
      await notifyAllByRole(
        ["Administrator", "Technical Administrator"],
        {
          senderId: req.user.user_id,
          senderName: req.user.username,
          type: "CASE_ASSIGNED",
          title: "Case Status Updated",
          message: `${req.user.username} updated ${reportNumber} to "${status}"`,
          linkTo: "/case-management",
        },
        req.user.user_id,
      );
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
    if (role === "Investigator") {
      whereConditions.push(`c.assigned_io_id = $${paramCount++}`);
      params.push(userId);
    } else if (role === "Patrol") {
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
    c.assigned_io_id,
    CONCAT(u.first_name, ' ', u.last_name) AS assigned_io_name,
    cr.crime_type,
    cr.place_barangay AS barangay,
    cr.report_number,
    cr.created_at
 FROM cases_v2 c
   LEFT JOIN users u ON c.assigned_io_id = u.user_id
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
    const result = await pool.query(
      `SELECT
    COUNT(*) AS total_cases,
    COUNT(*) FILTER (WHERE c.status = 'Under Investigation') AS active_cases,
    COUNT(*) FILTER (WHERE c.status = 'Solved') AS solved_cases,
    COUNT(*) FILTER (WHERE c.status = 'Cleared') AS cleared_cases,
    COUNT(*) FILTER (WHERE c.status = 'Referred') AS referred_cases,
    COUNT(*) FILTER (WHERE c.assigned_io_id IS NULL) AS unassigned_cases,
    COUNT(*) FILTER (WHERE c.priority = 'High') AS high_priority_cases
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
          CONCAT(u.first_name, ' ', u.last_name) AS assigned_io_name,
          cr.crime_type, cr.place_barangay AS barangay,
          cr.report_number, cr.created_at AS report_created_at
   FROM cases_v2 c
       LEFT JOIN users u ON c.assigned_io_id = u.user_id
       LEFT JOIN crime_reports_v2 cr ON c.report_id = cr.report_id
       WHERE c.id = $1`,
      [id],
    );

    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    const theCase = caseResult.rows[0];

    // Permission check
    if (role === "Investigator" && theCase.assigned_io_id !== userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
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

    const caseResult = await pool.query("SELECT * FROM cases_v2 WHERE id = $1", [
      id,
    ]);
    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });

    if (
      req.user.role === "Investigator" &&
      caseResult.rows[0].assigned_io_id !== req.user.user_id
    )
      return res
        .status(403)
        .json({ success: false, message: "You are not assigned to this case" });

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
      await createNotification({
        recipientId: assignedIoId,
        senderId: req.user.user_id,
        senderName: req.user.username,
        type: "CASE_ASSIGNED",
        title: "New Note Added",
        message: `${req.user.username} added a note to ${reportNumber}`,
        linkTo: "/case-management",
      });
    }
    // Notify admins if investigator added the note
    if (req.user.role === "Investigator") {
      await notifyAllByRole(
        ["Administrator", "Technical Administrator"],
        {
          senderId: req.user.user_id,
          senderName: req.user.username,
          type: "CASE_ASSIGNED",
          title: "New Note Added",
          message: `${req.user.username} added a note to ${reportNumber}`,
          linkTo: "/case-management",
        },
        req.user.user_id,
      );
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
    const { priority } = req.body;
    if (!["Low", "Medium", "High"].includes(priority))
      return res
        .status(400)
        .json({ success: false, message: "Invalid priority" });

    const caseResult = await pool.query("SELECT * FROM cases_v2 WHERE id = $1", [
      id,
    ]);
    if (caseResult.rows.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Case not found" });
    if (
      req.user.role === "Investigator" &&
      caseResult.rows[0].assigned_io_id !== req.user.user_id
    )
      return res
        .status(403)
        .json({ success: false, message: "You are not assigned to this case" });

    const result = await pool.query(
      "UPDATE cases_v2 SET priority = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [priority, id],
    );
    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Case Priority Updated",
      description: `Updated case ID ${id} priority to "${priority}"`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    const reportNumber = (await getReportNumberForCase(id)) || `Case #${id}`;

    const assignedIoId = caseResult.rows[0].assigned_io_id;
    if (assignedIoId && assignedIoId !== req.user.user_id) {
      await createNotification({
        recipientId: assignedIoId,
        senderId: req.user.user_id,
        senderName: req.user.username,
        type: "CASE_ASSIGNED",
        title: "Case Priority Updated",
        message: `${reportNumber} priority changed to "${priority}"`,
        linkTo: "/case-management",
      });
    }
    if (req.user.role === "Investigator") {
      await notifyAllByRole(
        ["Administrator", "Technical Administrator"],
        {
          senderId: req.user.user_id,
          senderName: req.user.username,
          type: "CASE_ASSIGNED",
          title: "Case Priority Updated",
          message: `${req.user.username} updated ${reportNumber} priority to "${priority}"`,
          linkTo: "/case-management",
        },
        req.user.user_id,
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    if (
      req.user.role === "Investigator" &&
      existing.rows[0].added_by_id !== req.user.user_id
    )
      return res
        .status(403)
        .json({ success: false, message: "Cannot edit others' notes" });

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

    if (
      req.user.role === "Investigator" &&
      existing.rows[0].added_by_id !== req.user.user_id
    )
      return res
        .status(403)
        .json({ success: false, message: "Cannot delete others' notes" });

    await pool.query("UPDATE case_notes_v2 SET deleted_at = NOW() WHERE id = $1", [
      noteId,
    ]);

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

    await pool.query("UPDATE case_notes_v2 SET deleted_at = NULL WHERE id = $1", [
      noteId,
    ]);
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
  getCases,
  getCaseById,
  addNote,
  editNote,
  deleteNote,
  restoreNote,
  getStatistics,
};