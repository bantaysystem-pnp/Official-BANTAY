// backend\features\crime-map\controllers\crimeMapController.js

const pool = require("../../../config/database");

const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const { expandBarangays, normalizeBarangay } = require("../../../shared/utils/barangays");

function getIncidenceThresholds(dateFrom, dateTo) {
  const days =
    Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;
  if (days <= 29) return { lowMax: 1, medMax: 2 };
  if (days <= 91) return { lowMax: 1, medMax: 3 };
  if (days <= 364) return { lowMax: 2, medMax: 5 };
  return { lowMax: 3, medMax: 8 };
}

function getIncidenceColor(crimeCount, dateFrom, dateTo) {
  const { lowMax, medMax } = getIncidenceThresholds(dateFrom, dateTo);

  if (crimeCount === 0) return { color: "#ffffff", risk: "None" };

  if (crimeCount <= lowMax) return { color: "#eab308", risk: "Low Incidence" };
  if (crimeCount <= medMax)
    return { color: "#f97316", risk: "Moderate Incidence" };
  return { color: "#b91c1c", risk: "High Incidence" };
}

function getIncidenceMinCount(dateFrom, dateTo) {
  const { lowMax } = getIncidenceThresholds(dateFrom, dateTo);
  return lowMax + 1;
}

function getHighIncidenceMinCount(dateFrom, dateTo) {
  const { medMax } = getIncidenceThresholds(dateFrom, dateTo);
  return medMax + 1;
}

// ============================================================
// SHARED: base FROM/JOIN used across every query in this file
// ============================================================
const FROM_JOIN = `FROM crime_reports_v2 cr
  LEFT JOIN cases_v2 c ON c.report_id = cr.report_id
  LEFT JOIN crime_modus_reference cmr ON cmr.id = cr.modus_reference_id`;

// ============================================================
// HELPER: Get assigned barangays for a patrol user's ongoing schedule
// ============================================================
const getPatrolUserBarangays = async (userId) => {
  try {
    const result = await pool.query(
      `
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
    `,
      [userId],
    );

    return result.rows.map((r) => r.barangay.toUpperCase());
  } catch (error) {
    console.error("getPatrolUserBarangays error:", error);
    return [];
  }
};

const getBoundaries = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    let crimeQuery = `
      SELECT 
        UPPER(TRIM(cr.place_barangay)) as barangay,
        COUNT(*) as crime_count
      ${FROM_JOIN}
      WHERE cr.is_deleted = false
        AND cr.lat IS NOT NULL
    `;
    const params = [];
    let p = 1;

    if (date_from) {
      crimeQuery += ` AND cr.date_time_commission >= $${p++}`;
      params.push(date_from);
    }
    if (date_to) {
      crimeQuery += ` AND cr.date_time_commission < ($${p++}::date + interval '1 day')`;
      params.push(date_to);
    }

    const rawTypes = req.query.incident_type;
    const incidentTypes = rawTypes
      ? (Array.isArray(rawTypes) ? rawTypes : rawTypes.split(","))
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (incidentTypes.length) {
      crimeQuery += ` AND UPPER(TRIM(cr.crime_type)) = ANY($${p++}::text[])`;
      params.push(incidentTypes);
    }

    const rawBarangays = req.query.barangays || req.query.barangay;
    const barangayList = rawBarangays
      ? (Array.isArray(rawBarangays) ? rawBarangays : rawBarangays.split(","))
          .map((b) => b.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (barangayList.length > 0) {
      crimeQuery += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
      params.push(expandBarangays(barangayList));
    }

    // Patrol user barangay restriction - ONLY apply if they have an ongoing schedule
    const { role_name, user_id } = req.user || {};
    if (role_name === "Patrol") {
      const assignedBarangays = await getPatrolUserBarangays(user_id);
      // Only restrict if they have assigned barangays (ongoing schedule)
      if (assignedBarangays.length > 0) {
        crimeQuery += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
        params.push(expandBarangays(assignedBarangays));
      }
      // If no assignedBarangays, don't add any filter - they see all data like admin
    }

    crimeQuery += ` GROUP BY UPPER(TRIM(cr.place_barangay))`;

    const client = await pool.connect();
    let crimeResult, barangayResult;
    try {
      [crimeResult, barangayResult] = await Promise.all([
        client.query(crimeQuery, params),
        client.query(
          `SELECT name_db, name_kml, centroid_lat, centroid_lng FROM barangay_map_data ORDER BY name_db`,
        ),
      ]);
    } finally {
      client.release();
    }

    const crimeMap = {};
    crimeResult.rows.forEach((r) => {
      const current = normalizeBarangay(r.barangay);
      crimeMap[current] = (crimeMap[current] || 0) + parseInt(r.crime_count, 10);
    });

    const boundaries = barangayResult.rows.map((b) => {
      const key = normalizeBarangay(b.name_db);
      const count = crimeMap[key] || 0;
      const { color, risk } = getIncidenceColor(
        count,
        date_from || "2000-01-01",
        date_to || new Date().toISOString().slice(0, 10),
      );

      return {
        name_db: b.name_db,
        name_kml: b.name_kml,
        centroid_lat: parseFloat(b.centroid_lat),
        centroid_lng: parseFloat(b.centroid_lng),
        crime_count: count,
        color,
        risk,
      };
    });

    res.json({ success: true, data: boundaries });
  } catch (error) {
    console.error("getBoundaries error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPins = async (req, res) => {
  try {
    const { date_from, date_to, incident_type } = req.query;

    let query = `
      SELECT 
        cr.report_id AS blotter_id,
        cr.report_number AS blotter_entry_number,
        cr.crime_type AS incident_type,
        cr.place_barangay,
        NULL AS place_street,
        cr.type_of_place,
        cmr.modus_name AS modus,
        c.status,
        cr.date_time_commission,
        cr.lat,
        cr.lng
      ${FROM_JOIN}
      WHERE cr.is_deleted = false
        AND cr.lat IS NOT NULL 
        AND cr.lng IS NOT NULL
    `;
    const params = [];
    let p = 1;

    if (date_from) {
      query += ` AND cr.date_time_commission >= $${p++}`;
      params.push(date_from);
    }
    if (date_to) {
      query += ` AND cr.date_time_commission < ($${p++}::date + interval '1 day')`;
      params.push(date_to);
    }
    if (incident_type) {
      const types = (
        Array.isArray(incident_type) ? incident_type : incident_type.split(",")
      )
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      if (types.length > 0) {
        query += ` AND UPPER(TRIM(cr.crime_type)) = ANY($${p++}::text[])`;
        params.push(types);
      }
    }
    const rawBarangays = req.query.barangays || req.query.barangay;
    const barangayList = rawBarangays
      ? (Array.isArray(rawBarangays) ? rawBarangays : rawBarangays.split(","))
          .map((b) => b.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (barangayList.length > 0) {
      query += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
      params.push(expandBarangays(barangayList));
    }
    if (req.query.modus) {
      query += ` AND UPPER(cmr.modus_name) = UPPER($${p++})`;
      params.push(req.query.modus);
    }
    if (req.query.hour !== undefined && req.query.hour !== "") {
      query += ` AND EXTRACT(HOUR FROM cr.date_time_commission) = $${p++}`;
      params.push(parseInt(req.query.hour, 10));
    }
    if (req.query.day) {
      query += ` AND TRIM(TO_CHAR(cr.date_time_commission, 'Day')) = $${p++}`;
      params.push(req.query.day);
    }

    const { role_name, user_id } = req.user || {};
    const client = await pool.connect();
    let result;
    try {
      if (role_name === "Barangay Official") {
        const bdRes = await client.query(
          `SELECT bd.barangay_code FROM barangay_details bd WHERE bd.user_id = $1`,
          [user_id],
        );
        if (bdRes.rows.length > 0) {
          query += ` AND UPPER(TRIM(cr.place_barangay)) = UPPER($${p++})`;
          params.push(bdRes.rows[0].barangay_code);
        }
      }

      if (role_name === "Patrol") {
        const assignedBarangays = await getPatrolUserBarangays(user_id);
        // Only restrict if they have assigned barangays (ongoing schedule)
        if (assignedBarangays.length > 0) {
          query += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
          params.push(expandBarangays(assignedBarangays));
        }
        // If no assignedBarangays, don't add any filter - they see all data like admin
      }

      query += ` ORDER BY cr.date_time_commission DESC`;
      result = await client.query(query, params);
    } finally {
      client.release();
    }

    const colorMap = {
      ROBBERY: "#ef4444",
      THEFT: "#f97316",
      "PHYSICAL INJURIES": "#eab308",
      "PHYSICAL INJURY": "#eab308",
      HOMICIDE: "#8b5cf6",
      MURDER: "#7c3aed",
      RAPE: "#ec4899",
      "CARNAPPING - MC": "#3b82f6",
      "CARNAPPING - MV": "#0ea5e9",
      "SPECIAL COMPLEX CRIME": "#14b8a6",
    };

    const pins = result.rows.map((r) => {
      const dt = r.date_time_commission
        ? new Date(r.date_time_commission)
        : null;
      const days = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return {
        ...r,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        color: colorMap[r.incident_type?.toUpperCase()] || "#6b7280",
        time: dt
          ? dt.toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        day_of_week: dt ? days[dt.getDay()] : null,
      };
    });

    res.json({ success: true, count: pins.length, data: pins });
  } catch (error) {
    console.error("getPins error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStatistics = async (req, res) => {
  try {
    const { date_from, date_to, incident_type } = req.query;

    let baseWhere = `WHERE cr.is_deleted = false AND cr.lat IS NOT NULL`;
    const params = [];
    let p = 1;

    if (date_from) {
      baseWhere += ` AND cr.date_time_commission >= $${p++}`;
      params.push(date_from);
    }
    if (date_to) {
      baseWhere += ` AND cr.date_time_commission < ($${p++}::date + interval '1 day')`;
      params.push(date_to);
    }
    if (incident_type) {
      const types = (
        Array.isArray(incident_type) ? incident_type : incident_type.split(",")
      )
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      if (types.length > 0) {
        baseWhere += ` AND UPPER(TRIM(cr.crime_type)) = ANY($${p++}::text[])`;
        params.push(types);
      }
    }

    const rawBarangays = req.query.barangays || req.query.barangay;
    const barangayList = rawBarangays
      ? (Array.isArray(rawBarangays) ? rawBarangays : rawBarangays.split(","))
          .map((b) => b.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (barangayList.length > 0) {
      baseWhere += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
      params.push(expandBarangays(barangayList));
    }

    // Patrol user barangay restriction - ONLY apply if they have an ongoing schedule
    const { role_name, user_id } = req.user || {};
    if (role_name === "Patrol") {
      const assignedBarangays = await getPatrolUserBarangays(user_id);
      // Only restrict if they have assigned barangays (ongoing schedule)
      if (assignedBarangays.length > 0) {
        baseWhere += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
        params.push(assignedBarangays);
      }
      // If no assignedBarangays, don't add any filter - they see all data like admin
    }

    const incidenceMin = getIncidenceMinCount(
      date_from || "2000-01-01",
      date_to || new Date().toISOString().slice(0, 10),
    );
    const highIncidenceMin = getHighIncidenceMinCount(
      date_from || "2000-01-01",
      date_to || new Date().toISOString().slice(0, 10),
    );

    const client = await pool.connect();
    let totalPins,
      byIncidentType,
      incidenceBarangays,
      highIncidenceBarangays,
      recentIncidents,
      totalBlotters;
    try {
      [
        totalPins,
        byIncidentType,
        incidenceBarangays,
        highIncidenceBarangays,
        recentIncidents,
        totalBlotters,
      ] = await Promise.all([
        client.query(
          `SELECT COUNT(*) ${FROM_JOIN} ${baseWhere}`,
          params,
        ),
        client.query(
          `SELECT cr.crime_type as incident_type, COUNT(*) as count ${FROM_JOIN} ${baseWhere} GROUP BY cr.crime_type ORDER BY count DESC`,
          params,
        ),
        client.query(
          `SELECT UPPER(TRIM(cr.place_barangay)) as barangay, COUNT(*) as count
           ${FROM_JOIN} ${baseWhere}
           GROUP BY UPPER(TRIM(cr.place_barangay))
           HAVING COUNT(*) >= 1
           ORDER BY count DESC, barangay ASC`,
          params,
        ),
        client.query(
          `SELECT UPPER(TRIM(cr.place_barangay)) as barangay, COUNT(*) as count
           ${FROM_JOIN} ${baseWhere}
           GROUP BY UPPER(TRIM(cr.place_barangay))
           HAVING COUNT(*) >= $${params.length + 1}::int
           ORDER BY count DESC, barangay ASC`,
          [...params, highIncidenceMin],
        ),
        client.query(
          `SELECT cr.report_number as blotter_entry_number, cr.crime_type as incident_type, cr.place_barangay, cr.date_time_commission ${FROM_JOIN} ${baseWhere} ORDER BY cr.date_time_commission DESC LIMIT 5`,
          params,
        ),
        client.query(
          `SELECT COUNT(*) FROM crime_reports_v2 WHERE is_deleted = false`,
        ),
      ]);
    } finally {
      client.release();
    }

    const incidenceWithLevel = incidenceBarangays.rows.reduce((acc, row) => {
      const current = normalizeBarangay(row.barangay);
      const count = parseInt(row.count, 10);
      const existing = acc.find((r) => r.barangay === current);
      if (existing) {
        existing.count += count;
      } else {
        const { risk } = getIncidenceColor(count, date_from || "2000-01-01", date_to || new Date().toISOString().slice(0, 10));
        acc.push({ barangay: current, count, risk });
      }
      return acc;
    }, []).sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        total_pins: parseInt(totalPins.rows[0].count, 10),
        total_blotters: parseInt(totalBlotters.rows[0].count, 10),
        barangays_with_crimes: incidenceWithLevel.length,
        incidence_count: incidenceWithLevel.length,
        high_incidence_count: highIncidenceBarangays.rows.length,
        top_crime: byIncidentType.rows[0]?.incident_type || null,
        top_barangay: incidenceWithLevel[0]?.barangay || null,
        by_incident_type: byIncidentType.rows,
        incidence_barangays: incidenceWithLevel,
        recent_incidents: recentIncidents.rows,
      },
    });
  } catch (error) {
    console.error("getStatistics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getHeatmap = async (req, res) => {
  try {
    const { date_from, date_to, incident_type } = req.query;

    let baseWhere = `
      WHERE cr.is_deleted = false
        AND cr.lat IS NOT NULL
        AND cr.lng IS NOT NULL
    `;
    const params = [];
    let p = 1;

    if (date_from) {
      baseWhere += ` AND cr.date_time_commission >= $${p++}`;
      params.push(date_from);
    }
    if (date_to) {
      baseWhere += ` AND cr.date_time_commission < ($${p++}::date + interval '1 day')`;
      params.push(date_to);
    }

    // ── Parse crime types ONCE — reused for both the SQL filter and the AI payload ──
    const incidentTypesList = incident_type
      ? (Array.isArray(incident_type) ? incident_type : incident_type.split(","))
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (incidentTypesList.length > 0) {
      baseWhere += ` AND UPPER(TRIM(cr.crime_type)) = ANY($${p++}::text[])`;
      params.push(incidentTypesList);
    }

    const rawBarangays = req.query.barangays || req.query.barangay;
    const barangayList = rawBarangays
      ? (Array.isArray(rawBarangays) ? rawBarangays : rawBarangays.split(","))
          .map((b) => b.trim().toUpperCase())
          .filter(Boolean)
      : [];

    if (barangayList.length > 0) {
      baseWhere += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
      params.push(expandBarangays(barangayList));
    }

    // Patrol user barangay restriction - ONLY apply if they have an ongoing schedule
    const { role_name, user_id } = req.user || {};
    if (role_name === "Patrol") {
      const assignedBarangays = await getPatrolUserBarangays(user_id);
      // Only restrict if they have assigned barangays (ongoing schedule)
      if (assignedBarangays.length > 0) {
        baseWhere += ` AND UPPER(TRIM(cr.place_barangay)) = ANY($${p++}::text[])`;
        params.push(assignedBarangays);
      }
      // If no assignedBarangays, don't add any filter - they see all data like admin
    }

    const pointsSQL = `
      SELECT
        cr.report_id AS blotter_id,
        UPPER(TRIM(cr.crime_type)) AS incident_type,
        UPPER(TRIM(cr.place_barangay)) AS place_barangay,
        cr.date_time_commission,
        cr.lat::float,
        cr.lng::float
      FROM crime_reports_v2 cr
      ${baseWhere}
      ORDER BY cr.date_time_commission DESC
    `;

    const client = await pool.connect();
    let pointsResult;
    try {
      // Barangay Official override
      if (role_name === "Barangay Official") {
        const bdRes = await client.query(
          `SELECT barangay_code FROM barangay_details WHERE user_id = $1`,
          [user_id],
        );
        if (bdRes.rows.length > 0) {
          // Rebuild with barangay official filter
          const brgyCode = bdRes.rows[0].barangay_code.toUpperCase();
          pointsResult = await client.query(
            pointsSQL.replace(
              /UPPER\(TRIM\(cr\.place_barangay\)\) = ANY\(\$\d+::text\[\]\)/,
              `UPPER(TRIM(cr.place_barangay)) = UPPER($${params.length + 1})`,
            ),
            [...params, brgyCode],
          );
        } else {
          pointsResult = await client.query(pointsSQL, params);
        }
      } else {
        pointsResult = await client.query(pointsSQL, params);
      }
    } finally {
      client.release();
    }

    const aiPayload = {
      date_from: date_from || "2000-01-01",
      date_to: date_to || new Date().toISOString().slice(0, 10),
      crime_types: incidentTypesList,
      barangays: barangayList.length > 0 ? barangayList : [],
    };

    let dbscanClusters = [];
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/clusters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPayload),
        signal: AbortSignal.timeout(8000),
      });
      const aiData = await aiRes.json();
      dbscanClusters = aiData.clusters || [];
    } catch (aiErr) {
      console.warn(
        "DBSCAN service unavailable, skipping clusters:",
        aiErr.message,
      );
    }

    const CRIME_WEIGHTS = {
      MURDER: 1.0,
      HOMICIDE: 1.0,
      "SPECIAL COMPLEX CRIME": 1.0,
      RAPE: 0.7,
      ROBBERY: 0.5,
      "CARNAPPING - MV": 0.3,
      "CARNAPPING - MC": 0.3,
      "PHYSICAL INJURY": 0.2,
      THEFT: 0.1,
    };

    const pointFeatures = pointsResult.rows.map((r) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [r.lng, r.lat],
      },
      properties: {
        weight: CRIME_WEIGHTS[r.incident_type?.toUpperCase()] ?? 0.1,
        incident_type: r.incident_type,
        barangay: r.place_barangay,
        date: r.date_time_commission,
      },
    }));

    const maxCount = dbscanClusters.length
      ? Math.max(...dbscanClusters.map((c) => c.count))
      : 1;

    const clusterFeatures = dbscanClusters.map((c, i) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [c.centroid_lng, c.centroid_lat],
      },
      properties: {
        cluster: true,
        count: c.count,
        dominant_crime: c.dominant_crime,
        dominant_barangay: c.dominant_barangay ?? "Unknown",
        intensity: Math.min(1, c.count / maxCount),
        rank: i + 1,
        crime_types: c.crime_types,
        dominant_modus: c.dominant_modus,
        radius_m: c.radius_m ?? 100,
      },
    }));

    return res.json({
      success: true,
      total_points: pointFeatures.length,
      total_clusters: clusterFeatures.length,
      points: {
        type: "FeatureCollection",
        features: pointFeatures,
      },
      clusters: {
        type: "FeatureCollection",
        features: clusterFeatures,
      },
    });
  } catch (error) {
    console.error("getHeatmap error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getBoundaries,
  getPins,
  getStatistics,
  getHeatmap,
  getPatrolUserBarangays,
};