// backend/features/dashboard/controllers/crimeDashboardController.js

const pool = require("../../../config/database");

const { expandBarangays } = require("../../../shared/utils/barangays");

const INDEX_CRIMES = [
  "MURDER",
  "HOMICIDE",
  "PHYSICAL INJURY",
  "RAPE",
  "ROBBERY",
  "THEFT",
  "CARNAPPING - MC",
  "CARNAPPING - MV",
  "SPECIAL COMPLEX CRIME",
];

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Expression used everywhere we need the weekday name — day_of_incident isn't
// a stored column on crime_reports_v2 like it was on the old view, so we
// derive it from date_time_commission instead.
const DAY_OF_WEEK_EXPR = `TRIM(TO_CHAR(cr.date_time_commission, 'FMDay'))`;

// ─── SHARED WHERE BUILDER ─────────────────────────────────────────────────────
// Base FROM/JOIN every query shares: crime_reports_v2 is the source of truth,
// cases_v2 carries status/priority (1:1 via report_id), is guaranteed to exist
// per report since CrimeReportV2.create() inserts both in one transaction.
const BASE_FROM = `FROM crime_reports_v2 cr
     JOIN cases_v2 c ON c.report_id = cr.report_id`;

const buildWhere = (query) => {
  const { date_from, date_to, crime_types, barangays } = query;
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
  if (crime_types) {
    const types = crime_types
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    if (types.length > 0) {
      conditions.push(`UPPER(cr.crime_type) = ANY($${p++}::text[])`);
      params.push(types);
    }
  }
  if (barangays) {
    const brgyList = barangays
      .split(",")
      .map((b) => b.trim().toUpperCase())
      .filter(Boolean);
    if (brgyList.length > 0) {
      const expanded = expandBarangays(brgyList);
      conditions.push(`UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`);
      params.push(expanded);
    }
  }

  // NOTE: no more status filtering here — cases_v2.status is a clean enum
  // ('Under Investigation' | 'Solved' | 'Cleared' | 'Referred') via CHECK
  // constraint, so there's no legacy-string cleanup needed like the old
  // blotter_analytics_view had.

  const where = "WHERE " + conditions.join(" AND ");
  return { where, params, nextP: p };
};

// ─── INDIVIDUAL QUERY HELPERS ─────────────────────────────────────────────────

const querySummary = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      UPPER(cr.crime_type) AS crime,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE c.status = 'Cleared') AS cleared,
      COUNT(*) FILTER (WHERE c.status = 'Solved') AS solved,
      COUNT(*) FILTER (
        WHERE c.status IN ('Under Investigation', 'Referred')
      ) AS under_investigation
     ${BASE_FROM}
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
     GROUP BY UPPER(cr.crime_type)`,
    [...params, INDEX_CRIMES],
  );

  const map = {};
  result.rows.forEach((r) => {
    map[r.crime] = r;
  });

  return INDEX_CRIMES.map((crime) => ({
    crime,
    total: parseInt(map[crime]?.total || 0),
    cleared: parseInt(map[crime]?.cleared || 0),
    solved: parseInt(map[crime]?.solved || 0),
    underInvestigation: parseInt(map[crime]?.under_investigation || 0),
  }));
};

// ─── queryTrends ──────────────────────────────────────────────────────────────
// granularity values: "daily" | "weekly" | "monthly"
//
// ROOT CAUSE FIX (weekly key mismatch) — unchanged from the view-based version:
//   Postgres DATE_TRUNC('week') snaps each record to the Monday (or Sunday)
//   of its week, regardless of what dateFrom is. The skeleton is built
//   starting at dateFrom, so DB week-labels are merged into the skeleton
//   bucket via closest-<=-match rather than exact key equality.
const queryTrends = async (
  where,
  params,
  nextP,
  granularity = "monthly",
  dateFrom,
  dateTo,
) => {
  const dateTrunc =
  granularity === "daily"
    ? "day"
    : granularity === "weekly"
      ? "week"
      : granularity === "quarterly"
        ? "quarter"
        : "month";

  const result = await pool.query(
    `SELECT
      TO_CHAR(DATE_TRUNC('${dateTrunc}', cr.date_time_commission), 'YYYY-MM-DD') AS label,
      UPPER(cr.crime_type) AS crime,
      COUNT(*) AS count
     ${BASE_FROM}
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
     GROUP BY label, UPPER(cr.crime_type)
     ORDER BY label ASC`,
    [...params, INDEX_CRIMES],
  );

  // Build map of DB results
  const dbMap = {};
  result.rows.forEach((r) => {
    const label = r.label;
    if (!dbMap[label]) {
      dbMap[label] = { label, Total: 0 };
      INDEX_CRIMES.forEach((c) => {
        dbMap[label][c] = 0;
      });
    }
    dbMap[label][r.crime] = parseInt(r.count);
    dbMap[label].Total += parseInt(r.count);
  });

  // Without a date range just return raw DB results
  if (!dateFrom || !dateTo) {
    return Object.values(dbMap).sort((a, b) => a.label.localeCompare(b.label));
  }

  // Helper: format a Date as YYYY-MM-DD using LOCAL time (not UTC)
  const toLocalIso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // ── Build skeleton cursor — snap to period boundary ────────────────────────
  const cursor = new Date(dateFrom + "T00:00:00");

  if (dateTrunc === "month") {
    cursor.setDate(1);
  }
  // For weekly: do NOT snap the cursor. We start from dateFrom as-is.
  // The merge step below handles the key mismatch by proximity matching.

  // ── Build skeleton end — extend to include the period containing dateTo ────
  const end = new Date(dateTo + "T00:00:00");
  if (dateTrunc === "week") {
  end.setDate(end.getDate() + 6);
} else if (dateTrunc === "month") {
  end.setDate(end.getDate() + 31);
} else if (dateTrunc === "quarter") {
  end.setMonth(end.getMonth() + 3);
}

  // ── Walk cursor and build skeleton ─────────────────────────────────────────
  const skeleton = {};
  const skeletonKeys = []; // kept in sorted order for binary-search style lookup

  const cursorClone = new Date(cursor);
  while (cursorClone <= end) {
    const label = toLocalIso(cursorClone);
    skeleton[label] = { label, Total: 0 };
    INDEX_CRIMES.forEach((c) => {
      skeleton[label][c] = 0;
    });
    skeletonKeys.push(label);

    if (dateTrunc === "day") cursorClone.setDate(cursorClone.getDate() + 1);
else if (dateTrunc === "week") cursorClone.setDate(cursorClone.getDate() + 7);
else if (dateTrunc === "quarter") cursorClone.setMonth(cursorClone.getMonth() + 3);
else cursorClone.setMonth(cursorClone.getMonth() + 1);
  }

  // ── Merge DB data into skeleton ────────────────────────────────────────────
  if (dateTrunc === "week") {
    // For weekly granularity, DB labels are snapped to week boundaries (Mon/Sun)
    // by Postgres DATE_TRUNC, which may not align with our skeleton keys that
    // start from dateFrom. We map each DB bucket to the skeleton bucket whose
    // key is the largest value that is still <= the DB label (i.e. the skeleton
    // week that "contains" this DB week).
    Object.keys(dbMap).forEach((dbLabel) => {
      let bestKey = null;
      for (const sk of skeletonKeys) {
        if (sk <= dbLabel) bestKey = sk;
        else break;
      }
      if (bestKey !== null) {
        const src = dbMap[dbLabel];
        skeleton[bestKey].Total += src.Total;
        INDEX_CRIMES.forEach((c) => {
          skeleton[bestKey][c] = (skeleton[bestKey][c] || 0) + (src[c] || 0);
        });
      }
    });
  } else {
    // For daily/monthly, Postgres truncation always produces keys that exactly
    // match the skeleton keys, so a direct lookup is safe.
    Object.keys(dbMap).forEach((label) => {
      if (skeleton[label] !== undefined) {
        skeleton[label] = dbMap[label];
      }
    });
  }

  // ── Remove skeleton buckets that are entirely beyond dateTo ───────────────
  // Keep a bucket if its label (period start) is <= dateTo, since it may
  // contain data up to dateTo.
  const trimmed = Object.values(skeleton)
  .filter((row) => {
    if (dateTrunc === "week" || dateTrunc === "quarter") {
      return row.label >= dateFrom && row.label <= dateTo;
    }
    return row.label <= dateTo;
  })
  .sort((a, b) => a.label.localeCompare(b.label));

  return trimmed;
};

const queryHourly = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      EXTRACT(HOUR FROM cr.date_time_commission)::int AS hour,
      UPPER(cr.crime_type) AS crime,
      COUNT(*) AS count
     ${BASE_FROM}
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
     GROUP BY hour, UPPER(cr.crime_type)
     ORDER BY hour ASC`,
    [...params, INDEX_CRIMES],
  );

  const map = {};
  result.rows.forEach((r) => {
    if (!map[r.hour]) map[r.hour] = { total: 0 };
    map[r.hour][r.crime] = parseInt(r.count);
    map[r.hour].total += parseInt(r.count);
  });

  return Array.from({ length: 24 }, (_, h) => {
    const period = h < 12 ? "AM" : "PM";
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return {
      hour: `${displayH}${period}`,
      count: map[h]?.total || 0,
      ...INDEX_CRIMES.reduce((acc, c) => ({ ...acc, [c]: map[h]?.[c] || 0 }), {}),
    };
  });
};

const queryByDay = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      ${DAY_OF_WEEK_EXPR} AS day,
      UPPER(cr.crime_type) AS crime,
      COUNT(*) AS count
     ${BASE_FROM}
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
     GROUP BY ${DAY_OF_WEEK_EXPR}, UPPER(cr.crime_type)
     ORDER BY count DESC`,
    [...params, INDEX_CRIMES],
  );

  const map = {};
  result.rows.forEach((r) => {
    if (!map[r.day]) map[r.day] = { total: 0 };
    map[r.day][r.crime] = parseInt(r.count);
    map[r.day].total += parseInt(r.count);
  });

  return DAYS_OF_WEEK.map((day) => ({
    day,
    count: map[day]?.total || 0,
    ...INDEX_CRIMES.reduce((acc, c) => ({ ...acc, [c]: map[day]?.[c] || 0 }), {}),
  }));
};

const queryPlace = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      TRIM(cr.type_of_place) AS place,
      UPPER(cr.crime_type) AS crime,
      COUNT(*) AS count
     ${BASE_FROM}
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
       AND cr.type_of_place IS NOT NULL
       AND TRIM(cr.type_of_place) <> ''
     GROUP BY TRIM(cr.type_of_place), UPPER(cr.crime_type)
     ORDER BY count DESC`,
    [...params, INDEX_CRIMES],
  );

  const map = {};
  result.rows.forEach((r) => {
    if (!map[r.place]) map[r.place] = { place: r.place, count: 0 };
    map[r.place][r.crime] = parseInt(r.count);
    map[r.place].count += parseInt(r.count);
  });

  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
};

const queryBarangay = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      TRIM(cr.place_barangay) AS barangay,
      UPPER(cr.crime_type) AS crime,
      COUNT(*) AS count
     ${BASE_FROM}
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
       AND cr.place_barangay IS NOT NULL
       AND TRIM(cr.place_barangay) <> ''
     GROUP BY TRIM(cr.place_barangay), UPPER(cr.crime_type)
     ORDER BY count DESC`,
    [...params, INDEX_CRIMES],
  );

  const map = {};
  result.rows.forEach((r) => {
    if (!map[r.barangay]) map[r.barangay] = { barangay: r.barangay, count: 0 };
    map[r.barangay][r.crime] = parseInt(r.count);
    map[r.barangay].count += parseInt(r.count);
  });

  return Object.values(map).sort((a, b) => b.count - a.count);
};

const queryModus = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      UPPER(cr.crime_type) AS crime,
      TRIM(cmr.modus_name) AS modus,
      COUNT(*) AS count
     ${BASE_FROM}
     LEFT JOIN crime_modus_reference cmr ON cmr.id = cr.modus_reference_id
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
       AND cmr.modus_name IS NOT NULL
       AND TRIM(cmr.modus_name) <> ''
     GROUP BY UPPER(cr.crime_type), TRIM(cmr.modus_name)
     ORDER BY count DESC
     LIMIT 50`,
    [...params, INDEX_CRIMES],
  );

  return result.rows.map((r) => ({
    crime: r.crime,
    modus: r.modus,
    count: parseInt(r.count),
  }));
};

const queryCompleteData = async (where, params, nextP) => {
  const result = await pool.query(
    `SELECT
      TRIM(cr.place_barangay)      AS barangay,
      TRIM(cr.type_of_place)       AS type_of_place,
      TO_CHAR(cr.date_time_commission, 'MM/DD/YYYY') AS date,
      TO_CHAR(cr.date_time_commission, 'HH12:MI AM') AS time,
      UPPER(cr.crime_type)         AS crime_offense,
      TRIM(cmr.modus_name)         AS modus,
      c.status                     AS case_status
     ${BASE_FROM}
     LEFT JOIN crime_modus_reference cmr ON cmr.id = cr.modus_reference_id
     ${where}
     AND UPPER(cr.crime_type) = ANY($${nextP}::text[])
     ORDER BY
       TRIM(cr.place_barangay) ASC,
       UPPER(cr.crime_type) ASC,
       CASE
         WHEN c.status = 'Under Investigation' THEN 0
         WHEN c.status = 'Cleared' THEN 1
         WHEN c.status = 'Solved' THEN 2
         ELSE 3
       END ASC`,
    [...params, INDEX_CRIMES],
  );

  return result.rows.map((r) => ({
    barangay: r.barangay || "",
    typeOfPlace: r.type_of_place || "",
    date: r.date || "",
    time: r.time || "",
    crimeOffense: r.crime_offense || "",
    modus: r.modus || "",
    caseStatus: r.case_status || "",
  }));
};

// ─── /overview — ALL 7 queries in one round trip ──────────────────────────────
// HELPER: Get assigned barangays for a patrol user's ongoing schedule
const getPatrolUserBarangays = async (userId) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT par.barangay
      FROM patrol_assignment pa
      JOIN patrol_assignment_patroller pap ON pa.patrol_id = pap.patrol_id
      JOIN active_patroller ap ON pap.active_patroller_id = ap.active_patroller_id
      JOIN patrol_assignment_route par ON pa.patrol_id = par.patrol_id
      WHERE ap.officer_id = $1
        AND pa.start_date <= CURRENT_DATE 
        AND pa.end_date >= CURRENT_DATE
        AND par.stop_order <= 0
        AND par.barangay IS NOT NULL
    `, [userId]);
    return result.rows.map(r => r.barangay.toUpperCase());
  } catch (error) {
    console.error("getPatrolUserBarangays error:", error);
    return [];
  }
};

const getOverview = async (req, res) => {
  try {
    let { where, params, nextP } = buildWhere(req.query);
    const { granularity = "monthly", date_from, date_to, preset } = req.query;

    // Patrol user barangay restriction
    const { role_name, user_id } = req.user || {};
    if (role_name === "Patrol") {
      const assignedBarangays = await getPatrolUserBarangays(user_id);
      if (assignedBarangays.length > 0) {
        // Override with patrol assigned barangays
        where = where.replace(
          /UPPER\(TRIM\(cr\.place_barangay\)\) = ANY\(\$\d+::text\[\]\)/,
          ""
        );
        params = params.filter((_, i) => {
          // Remove old barangay params by checking if value is an array
          return !Array.isArray(params[i]);
        });
        const expanded = expandBarangays(assignedBarangays);
        where += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${nextP}::text[])`;
        params.push(expanded);
        nextP++;
      }
    }

    const [
  summary,
  trends,
  hourly,
  byDay,
  place,
  barangay,
  modus,
  completeData,
] = await Promise.all([
  querySummary(where, params, nextP),
  queryTrends(where, params, nextP, granularity, date_from, date_to),
  queryHourly(where, params, nextP),
  queryByDay(where, params, nextP),
  queryPlace(where, params, nextP),
  queryBarangay(where, params, nextP),
  queryModus(where, params, nextP),
  queryCompleteData(where, params, nextP),
]);

// ── Previous month summary for "this_month" delta ─────────────────────────
let prevSummary = null;
if (preset === "this_month") {
  const now = new Date();
  const phtMs = now.getTime() + 8 * 60 * 60 * 1000;
  const pht = new Date(phtMs);

  // Previous month: full month (1st to last day)
  const prevMonthDate = new Date(pht.getFullYear(), pht.getMonth() - 1, 1);
  const prevFrom = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const prevLastDay = new Date(pht.getFullYear(), pht.getMonth(), 0).getDate();
  const prevTo = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-${String(prevLastDay).padStart(2, "0")}`;

  const { where: prevWhere, params: prevParams, nextP: prevNextP } = buildWhere({
    ...req.query,
    date_from: prevFrom,
    date_to: prevTo,
  });

  prevSummary = await querySummary(prevWhere, prevParams, prevNextP);
}

res.json({
  success: true,
  summary,
  trends,
  hourly,
  byDay,
  place,
  barangay,
  modus,
  completeData,
  prevSummary,
});
  } catch (err) {
    console.error("getOverview error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── Individual endpoints — kept for backwards compatibility ──────────────────
const getSummary = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await querySummary(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTrends = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const { granularity = "monthly", date_from, date_to } = req.query;
    const data = await queryTrends(
      where,
      params,
      nextP,
      granularity,
      date_from,
      date_to,
    );
    res.json({ success: true, data });
  } catch (err) {
    console.error("getTrends error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getHourly = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await queryHourly(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getHourly error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getByDay = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await queryByDay(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getByDay error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getByPlace = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await queryPlace(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getByPlace error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getByBarangay = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await queryBarangay(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getByBarangay error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getByModus = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await queryModus(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getByModus error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCompleteData = async (req, res) => {
  try {
    const { where, params, nextP } = buildWhere(req.query);
    const data = await queryCompleteData(where, params, nextP);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getCompleteData error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getOverview,
  getSummary,
  getTrends,
  getHourly,
  getByDay,
  getByPlace,
  getByBarangay,
  getByModus,
  getCompleteData,
  getPatrolUserBarangays,
};