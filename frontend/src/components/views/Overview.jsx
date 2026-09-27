// frontend/src/components/views/Overview.jsx
//
// Full-screen "command center" overview. This is a SEPARATE page/route from
// CrimeDashboard.jsx (which is left completely untouched). It is rendered
// OUTSIDE <PageLayout> in App.jsx, so the Sidebar and TopBar never mount for
// this route — no extra hide/show logic needed for those.
//
// Data: reuses the same GET {API}/crime-dashboard/overview endpoint and
// response shape CrimeDashboard.jsx already relies on (summary, trends,
// hourly, byDay, place, barangay, modus, completeData, mobileUnits). Wired
// against the CLIENT repo controller (crime_reports_v2 / cases_v2 schema).
// Mode of Reporting has been removed — it was sample-only and unwired.
//
// Layout: one fixed 100vh grid, no page scroll. Individual list/table
// panels may internally scroll (exactly like the reference screenshot's own
// "1-100/185" paginated lists) but the page itself never does.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CrimeMapping from "./CrimeMapping";
import "./Overview.css";

const API = `${import.meta.env.VITE_API_URL}/crime-dashboard`;
const getToken = () =>
  localStorage.getItem("token") || sessionStorage.getItem("token");

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

const CRIME_DISPLAY = {
  MURDER: "Murder",
  HOMICIDE: "Homicide",
  "PHYSICAL INJURY": "Physical Injury",
  RAPE: "Rape",
  ROBBERY: "Robbery",
  THEFT: "Theft",
  "CARNAPPING - MC": "Carnapping - MC",
  "CARNAPPING - MV": "Carnapping - MV",
  "SPECIAL COMPLEX CRIME": "Special Complex Crime",
};

// ── Fixed color assignments per crime type ─────────────────────────────────
const CRIME_COLORS = {
  MURDER: "#ef4444", // red
  HOMICIDE: "#3b82f6", // blue
  "PHYSICAL INJURY": "#22c55e", // green
  RAPE: "#eab308", // yellow
  ROBBERY: "#78350f", // brown
  THEFT: "#d4af37", // gold
  "CARNAPPING - MC": "#8b5cf6", // violet
  "CARNAPPING - MV": "#9333ea", // purple
  "SPECIAL COMPLEX CRIME": "#ec4899", // pink
};

// ── Case status colors ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  cleared: "#3b82f6", // blue
  underInvestigation: "#ef4444", // red
  solved: "#22c55e", // green
};

const MOBILE_UNIT_PALETTE = [
  "#19a7e0",
  "#ec4899",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#6366f1",
];

const formatBarangayLabel = (name) => {
  if (!name) return "";
  const ROMAN = new Set([
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
  ]);
  return name.toLowerCase().replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (ROMAN.has(upper)) return upper;
    if (upper === "P" || upper === "F") return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
};

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

const rankShade = (rank, totalRows) => {
  const span = Math.max(totalRows - 1, 1);
  const t = Math.min((rank - 1) / span, 1); // 0 = darkest, 1 = lightest
  const lightness = 28 + t * 44; // 28% (deep maroon) → 72% (soft pink-red)
  return {
    bg: `hsl(0, 74%, ${lightness}%)`,
    text: lightness < 55 ? "#fff" : "#3f0e0e",
  };
};

const getPhtToday = () => {
  const now = new Date();
  return new Date(now.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
};

const getDefaultRange = () => {
  const now = new Date();
  const pht = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const from = new Date(pht.getFullYear() - 1, pht.getMonth(), 1);
  return {
    dateFrom: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
    dateTo: getPhtToday(),
  };
};

const EMPTY = () => ({
  summary: [],
  trends: [],
  hourly: [],
  byDay: [],
  place: [],
  barangay: [],
  modus: [],
  completeData: [],
  mobileUnits: [],
});

/* ── tiny chart primitives (deliberately plain SVG/CSS, not recharts, so
   every panel scales exactly to its fixed-height grid cell with no
   surprise overflow) ─────────────────────────────────────────────────── */

const LineChartLabeled = ({
  data,
  labels = [],
  color = "#19a7e0",
  height = 100,
}) => {
  const width = 300;
  const padL = 26,
    padR = 8,
    padT = 10,
    padB = 18;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  if (!data.length) return <div className="ov-empty-mini">No data</div>;
  const max = Math.max(...data, 1);
  const stepX = plotW / Math.max(data.length - 1, 1);
  const yFor = (v) => padT + plotH - (v / max) * plotH;
  const points = data.map((v, i) => `${padL + i * stepX},${yFor(v)}`).join(" ");
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const labelEvery = Math.max(1, Math.ceil(labels.length / 8));

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {gridSteps.map((t, i) => {
        const y = padT + plotH * t;
        return (
          <g key={i}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
            <text
              x={padL - 4}
              y={y + 3}
              fontSize="7"
              fill="#9fb8d9"
              textAnchor="end"
            >
              {Math.round(max * (1 - t))}
            </text>
          </g>
        );
      })}
      <line
        x1={padL}
        x2={padL}
        y1={padT}
        y2={height - padB}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
      />
      <line
        x1={padL}
        x2={width - padR}
        y1={height - padB}
        y2={height - padB}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1"
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={padL + i * stepX}
          cy={yFor(v)}
          r="2.2"
          fill={color}
        />
      ))}
      {labels.map((lab, i) =>
        lab && i % labelEvery === 0 ? (
          <text
            key={i}
            x={padL + i * stepX}
            y={height - 5}
            fontSize="7"
            fill="#9fb8d9"
            textAnchor="middle"
          >
            {lab}
          </text>
        ) : null,
      )}
    </svg>
  );
};

const Donut = ({ segments, size = 74, thickness = 12 }) => {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0 }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={thickness}
      />
      {segments.map((seg, i) => {
        const frac = seg.value / total;
        const dash = frac * c;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
};

const VBars = ({ segments }) => {
  const max = Math.max(...segments.map((s) => s.value), 1);
  return (
    <div className="ov-vbars">
      {segments.map((s) => (
        <div className="ov-vbar-col" key={s.label}>
          <span className="ov-vbar-val">{s.value}</span>
          <div className="ov-vbar-track">
            <div
              className="ov-vbar-fill"
              style={{
                height: `${(s.value / max) * 100}%`,
                background: s.color,
              }}
            />
          </div>
          <span className="ov-vbar-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
};

const DonutPanel = ({ segments }) => {
  return (
    <div className="ov-donut-row">
      <Donut segments={segments} />
      <div className="ov-donut-legend">
        {segments.map((d) => (
          <div className="ov-donut-legend-item" key={d.label}>
            <span className="ov-donut-dot" style={{ background: d.color }} />
            <span className="ov-donut-legend-label">{d.label}</span>
            <span className="ov-donut-legend-val">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Overview() {
  const navigate = useNavigate();
  const location = useLocation();

  // Same shape as CrimeDashboard's appliedFilters. Falls back to the
  // default 1-year range with no restrictions if opened directly.
  const incomingFilters = location.state?.filters;

  const [filters, setFilters] = useState(() => {
    const range = getDefaultRange();
    return {
      dateFrom: incomingFilters?.dateFrom ?? range.dateFrom,
      dateTo: incomingFilters?.dateTo ?? range.dateTo,
      crimeTypes: incomingFilters?.crimeTypes ?? [],
      barangays: incomingFilters?.barangays ?? [],
      mobileUnits: incomingFilters?.mobileUnits ?? [],
    };
  });

  const [dashData, setDashData] = useState(EMPTY());
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 4;

  useEffect(() => {
    const params = new URLSearchParams({
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      granularity: "monthly",
      preset: "custom",
    });
    if (filters.crimeTypes.length)
      params.set("crime_types", filters.crimeTypes.join(","));
    if (filters.barangays.length)
      params.set("barangays", filters.barangays.join(","));
    if (filters.mobileUnits.length)
      params.set("mobile_units", filters.mobileUnits.join(","));

    setLoading(true);

    fetch(`${API}/overview?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setDashData({
            summary: json.summary ?? [],
            trends: json.trends ?? [],
            hourly: json.hourly ?? [],
            byDay: json.byDay ?? [],
            place: json.place ?? [],
            barangay: json.barangay ?? [],
            modus: json.modus ?? [],
            completeData: json.completeData ?? [],
            mobileUnits: json.mobileUnits ?? [],
          });
        }
      })
      .catch((err) => console.error("[Overview] fetch error:", err))
      .finally(() => setLoading(false));
  }, [filters]);

  const totals = useMemo(() => {
    const t = dashData.summary.reduce(
      (acc, d) => ({
        total: acc.total + (d.total || 0),
        cleared: acc.cleared + (d.cleared || 0),
        solved: acc.solved + (d.solved || 0),
        ui: acc.ui + (d.underInvestigation || 0),
      }),
      { total: 0, cleared: 0, solved: 0, ui: 0 },
    );
    return t;
  }, [dashData.summary]);

  const focusCrimeDonut = useMemo(
    () =>
      [...dashData.summary]
        .sort((a, b) => b.total - a.total)
        .map((d) => ({
          label: CRIME_DISPLAY[d.crime] || d.crime,
          value: d.total,
          color: CRIME_COLORS[d.crime] || "#19a7e0",
        })),
    [dashData.summary],
  );

  const barangayRanked = useMemo(
    () => [...dashData.barangay].sort((a, b) => b.count - a.count),
    [dashData.barangay],
  );

  const placeRanked = useMemo(
    () => [...dashData.place].sort((a, b) => b.count - a.count).slice(0, 6),
    [dashData.place],
  );

  // Modus is now a ranked table (like Place of Commission) instead of a donut.
  const modusRanked = useMemo(() => {
    const map = {};
    dashData.modus.forEach((m) => {
      map[m.modus] = (map[m.modus] || 0) + (m.count || 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([modus, count]) => ({ modus, count }));
  }, [dashData.modus]);

  // Mobile Units assigned to the crime — donut, same treatment as Focus Crime.
  const mobileUnitsDonut = useMemo(
    () =>
      [...dashData.mobileUnits]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((m, i) => ({
          label: m.unit,
          value: m.count,
          color: MOBILE_UNIT_PALETTE[i % MOBILE_UNIT_PALETTE.length],
        })),
    [dashData.mobileUnits],
  );

  const trendSpark = useMemo(
    () => dashData.trends.map((t) => t.Total || 0),
    [dashData.trends],
  );
  const trendLabels = useMemo(
    () =>
      dashData.trends.map((t) => {
        const raw = t.month || t.label || t.period || "";
        const [y, m] = raw.split("-");
        if (!y || !m) return raw;
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return `${monthNames[parseInt(m, 10) - 1]} '${y.slice(2)}`;
      }),
    [dashData.trends],
  );
  const hourlySpark = useMemo(
    () => dashData.hourly.map((h) => h.count || 0),
    [dashData.hourly],
  );
  const hourlyLabels = useMemo(
    () =>
      dashData.hourly.map((h) => {
        const hr = typeof h.hour === "number" ? h.hour : parseInt(h.hour, 10);
        if (Number.isNaN(hr)) return "";
        const period = hr >= 12 ? "PM" : "AM";
        const display = hr % 12 === 0 ? 12 : hr % 12;
        return `${display}${period}`;
      }),
    [dashData.hourly],
  );
  const byDayRows = useMemo(
    () =>
      [...dashData.byDay]
        .sort((a, b) => b.count - a.count)
        .map((d) => ({ label: d.day?.slice(0, 3) || "", value: d.count || 0 })),
    [dashData.byDay],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(dashData.completeData.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages - 1);
  const pageRecords = dashData.completeData.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );
  return (
    <div className="ov-fullscreen">
      <div className="ov-header">
        <div className="ov-header-left">
          <h1>Focus Crime Overview</h1>
        </div>
        <div className="ov-header-right">
          <span className="ov-header-range">
            {fmtDate(filters.dateFrom)} — {fmtDate(filters.dateTo)}
          </span>
          <button
            className="ov-exit-btn"
            onClick={() => navigate("/crime-dashboard")}
          >
            ✕ Exit Overview
          </button>
        </div>
      </div>

      {loading ? (
        <div className="ov-loading">Loading overview…</div>
      ) : (
        <div className="ov-grid">
          {/* Top row: KPI / Focus Crime / Mobile Units / Prone Day — sized
              independently via flex, so this row never touches the grid
              columns the panels below share. */}
          <div className="ov-area-toprow">
            <div className="ov-panel ov-top-kpi">
              <div className="ov-panel-head">Total of Focus Crime</div>
              <div className="ov-kpi-body">
                <div className="ov-kpi-value">{totals.total}</div>
                <div className="ov-kpi-mini-row">
                  <div className="ov-kpi-mini">
                    <span
                      className="ov-kpi-mini-val"
                      style={{ color: STATUS_COLORS.solved }}
                    >
                      {totals.solved}
                    </span>
                    <span className="ov-kpi-mini-lbl">Solved</span>
                  </div>
                  <div className="ov-kpi-mini">
                    <span
                      className="ov-kpi-mini-val"
                      style={{ color: STATUS_COLORS.cleared }}
                    >
                      {totals.cleared}
                    </span>
                    <span className="ov-kpi-mini-lbl">Cleared</span>
                  </div>
                  <div className="ov-kpi-mini">
                    <span
                      className="ov-kpi-mini-val"
                      style={{ color: STATUS_COLORS.underInvestigation }}
                    >
                      {totals.ui}
                    </span>
                    <span className="ov-kpi-mini-lbl">Under Inv.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ov-panel ov-top-focus">
              <div className="ov-panel-head">Focus Crime</div>
              <DonutPanel segments={focusCrimeDonut} />
            </div>

            <div className="ov-panel ov-top-mobile">
              <div className="ov-panel-head">Mobile Units</div>
              <DonutPanel segments={mobileUnitsDonut} />
            </div>

            <div className="ov-panel ov-top-proneday">
              <div className="ov-panel-head">Prone Day</div>
              <VBars
                segments={byDayRows.map((d) => ({ ...d, color: "#19a7e0" }))}
              />
            </div>
          </div>

          {/* Barangay ranking */}
          <div className="ov-panel ov-area-brgy">
            <div className="ov-panel-head">
              Barangay Ranking{" "}
              <span className="ov-count-tag">{barangayRanked.length}</span>
            </div>
            <div className="ov-panel-scroll">
              <table className="ov-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Barangay</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {barangayRanked.map((b, i) => {
                    const shade = rankShade(i + 1, barangayRanked.length);
                    return (
                      <tr key={b.barangay}>
                        <td className="ov-rank">{i + 1}</td>
                        <td className="ov-name">
                          {formatBarangayLabel(b.barangay)}
                        </td>
                        <td className="ov-num">
                          <span
                            className="ov-count-badge"
                            style={{ background: shade.bg, color: shade.text }}
                          >
                            {b.count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {barangayRanked.length === 0 && (
                    <tr>
                      <td colSpan={3} className="ov-empty-row">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trend / clock */}
          <div className="ov-panel ov-area-trends">
            <div className="ov-panel-head">Crime Trends</div>
            <div className="ov-linechart-wrap">
              <LineChartLabeled
                data={trendSpark}
                labels={trendLabels}
                color="#19a7e0"
              />
            </div>
          </div>
          <div className="ov-panel ov-area-clock">
            <div className="ov-panel-head">Crime Clock</div>
            <div className="ov-linechart-wrap">
              <LineChartLabeled
                data={hourlySpark}
                labels={hourlyLabels}
                color="#ec4899"
              />
            </div>
          </div>

          {/* Modus — now a ranked table, like Place of Commission */}
          <div className="ov-panel ov-area-modus">
            <div className="ov-panel-head">Modus</div>
            <div className="ov-panel-scroll">
              <table className="ov-table">
                <thead>
                  <tr>
                    <th>Modus</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {modusRanked.map((m, i) => {
                    const shade = rankShade(i + 1, modusRanked.length);
                    return (
                      <tr key={m.modus}>
                        <td className="ov-name">{m.modus}</td>
                        <td className="ov-num">
                          <span
                            className="ov-count-badge"
                            style={{ background: shade.bg, color: shade.text }}
                          >
                            {m.count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {modusRanked.length === 0 && (
                    <tr>
                      <td colSpan={2} className="ov-empty-row">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Place of commission */}
          <div className="ov-panel ov-area-place">
            <div className="ov-panel-head">Place of Commission</div>
            <div className="ov-panel-scroll">
              <table className="ov-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {placeRanked.map((p, i) => {
                    const shade = rankShade(i + 1, placeRanked.length);
                    return (
                      <tr key={p.place}>
                        <td className="ov-name">{p.place}</td>
                        <td className="ov-num">
                          <span
                            className="ov-count-badge"
                            style={{ background: shade.bg, color: shade.text }}
                          >
                            {p.count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {placeRanked.length === 0 && (
                    <tr>
                      <td colSpan={2} className="ov-empty-row">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Map */}
          <div className="ov-panel ov-area-map">
            <div className="ov-panel-head">Crime Map</div>
            <div className="ov-map-inner">
              <CrimeMapping
                minimal
                externalFilters={{
                  incident_types: filters.crimeTypes,
                  barangays: filters.barangays,
                  date_from: filters.dateFrom,
                  date_to: filters.dateTo,
                }}
                onFilterChange={(partial) =>
                  setFilters((f) => ({
                    ...f,
                    ...(partial.crimeTypes !== undefined && {
                      crimeTypes: partial.crimeTypes,
                    }),
                    ...(partial.barangays !== undefined && {
                      barangays: partial.barangays,
                    }),
                  }))
                }
              />
            </div>
          </div>

          {/* Bottom wide blotter table */}
          <div className="ov-panel ov-area-blotter">
            <div className="ov-panel-head">
              Detailed Crime Records
              <span className="ov-count-tag">
                {dashData.completeData.length}
              </span>
              <div className="ov-page-controls">
                <button
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ‹
                </button>
                <span>
                  {safePage + 1}/{totalPages}
                </span>
                <button
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="ov-panel-scroll">
              <table className="ov-table ov-blotter-table">
                <thead>
                  <tr>
                    <th>Crime</th>
                    <th>Barangay</th>
                    <th>Place</th>
                    <th>Modus</th>
                    <th>Date Committed</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((r, i) => (
                    <tr key={i}>
                      <td className="ov-crime-cell">
                        {CRIME_DISPLAY[r.crimeOffense] || r.crimeOffense || "—"}
                      </td>
                      <td>
                        {r.barangay ? formatBarangayLabel(r.barangay) : "—"}
                      </td>
                      <td>{r.typeOfPlace || "—"}</td>
                      <td>{r.modus || "—"}</td>
                      <td>
                        {r.date || "—"} {r.time ? `· ${r.time}` : ""}
                      </td>
                    </tr>
                  ))}
                  {pageRecords.length === 0 && (
                    <tr>
                      <td colSpan={5} className="ov-empty-row">
                        No records for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}