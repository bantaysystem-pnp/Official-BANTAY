// backend/features/blotter/controllers/exportBlotterController.js
// Generates an Excel export of blotter records, using the same header
// layout as the import template — so an exported file can be re-imported
// as-is, and duplicates get caught by the report_number unique constraint.

const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");
const ExcelJS = require("exceljs");

// Same order/casing as the import template — this is what makes
// export → re-import round-trip correctly.
const EXPORT_HEADERS = [
  "Report Number",
  "stageOfFelony",
  "barangay",
  "DATE",
  "TIME",
  "offense",
  "typeofOperation",
  "modus",
  "lat",
  "lng",
  "casestatus",
  "Assigned Mobile Unit",
];

// Column widths lifted from the reference template (test.xlsx) so the
// export visually matches what the team already uses. lng/casestatus had
// no explicit width set in the source file — approximated to a sane default.
const COLUMN_WIDTHS = [
  { wch: 21 }, // Report Number
  { wch: 28 }, // stageOfFelony
  { wch: 33 }, // barangay
  { wch: 19 }, // DATE
  { wch: 21 }, // TIME
  { wch: 14 }, // offense
  { wch: 35 }, // typeofOperation
  { wch: 22 }, // modus
  { wch: 11 }, // lat
  { wch: 11 }, // lng — approximated
  { wch: 14 }, // casestatus — approximated
  { wch: 19 }, // Assigned Mobile Unit
];

// getAll() returns date_time_commission as one combined string
// ("YYYY-MM-DDTHH:MM") — the template wants DATE and TIME as separate
// columns, so split it back apart.
const splitDateTime = (str) => {
  if (!str) return { date: "", time: "" };
  const cleaned = String(str).replace("Z", "").replace(/\+\d{2}:\d{2}$/, "");
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  // "2:30 PM" — matches the import's time regex (\d{1,2}):?(\d{2})?\s*(AM|PM)?
  return { date: `${y}-${m}-${day}`, time: `${hours}:${mins} ${ampm}` };
};

async function buildBlotterExcel(records, meta = {}) {
  const workbook = new ExcelJS.Workbook();

  // Sheet tab name follows the "cy <year>" convention from the reference
  // template, based on the export's date range.
  const year = meta.dateFrom ? new Date(meta.dateFrom).getFullYear() : new Date().getFullYear();
  const worksheet = workbook.addWorksheet(`cy ${year}`);

  // Column widths only — the table header itself is written by addTable()
  // below, not here, so this doesn't create a second header row.
  worksheet.columns = COLUMN_WIDTHS.map((w) => ({ width: w.wch }));

  const rows = records.map((r) => {
    const { date, time } = splitDateTime(r.date_time_commission);
    // Order must match EXPORT_HEADERS exactly — addTable() below writes
    // these as plain arrays, positional not keyed.
    return [
      r.report_number || "",
      r.stage_of_felony || "",
      r.place_barangay || "",
      date,
      time,
      r.crime_type || "",
      r.type_of_operation || "",
      // Export the NAME, not the id — findOrCreateModus / findOrCreateTypeOfOperation /
      // MobileUnit.findOrCreate on re-import resolve by name, same as manual entry.
      r.modus_name || "",
      r.lat ?? "",
      r.lng ?? "",
      r.status || r.case_status || "",
      r.assigned_mobile_name || "",
    ];
  });

  // Real Excel Table object — this is what gives the banded rows and
  // filter dropdown arrows. A plain styled range can't produce the filter
  // arrows; only an actual ListObject/Table can.
  worksheet.addTable({
    name: "BlotterRecords",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium6",
      showRowStripes: true,
    },
    columns: EXPORT_HEADERS.map((name) => ({ name, filterButton: true })),
    rows,
  });

  // Header cell colors flag hard-fail vs nullable columns to whoever opens
  // the file — same required/optional split enforced in importCrimeReports:
  // DATE, TIME, barangay, offense are the only columns that skip a row if
  // blank; everything else is nullable. Direct cell formatting here takes
  // priority over the table theme's default header fill, so this survives
  // being opened in Excel even with a table style applied.
  const REQUIRED_HEADERS = new Set(["barangay", "DATE", "TIME", "offense"]);
  const REQUIRED_FILL = "FF1E3A5F"; // navy — matches the app's --navy-primary
  const OPTIONAL_FILL = "FF6B7280"; // gray — signals "nullable"

  const headerRow = worksheet.getRow(1);
  EXPORT_HEADERS.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1); // ExcelJS columns are 1-indexed
    const isRequired = REQUIRED_HEADERS.has(header);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: isRequired ? REQUIRED_FILL : OPTIONAL_FILL },
    };
    cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
  });

  return workbook.xlsx.writeBuffer();
}

const exportBlotter = async (req, res) => {
  try {
    const { records = [], meta = {} } = req.body;

    const excelBuffer = await buildBlotterExcel(records, meta);

    const dateStr =
      meta.dateFrom && meta.dateTo
        ? `${meta.dateFrom}_to_${meta.dateTo}`
        : new Date().toISOString().slice(0, 10);

    await logAudit({
      userId:      req.user?.user_id,
      username:    req.user?.username,
      eventName:   "Blotter Records Exported",
      description: `Blotter records exported as Excel (${dateStr})`,
      action:      "EXPORT",
      status:      "success",
      source:      "Web Portal",
      ipAddress:   getClientIp(req),
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="blotter_export_${dateStr}.xlsx"`);
    res.send(excelBuffer);
  } catch (err) {
    console.error("exportBlotter error:", err);

    await logAudit({
      userId:    req.user?.user_id,
      username:  req.user?.username,
      eventName: "Blotter Export Failed",
      description: err.message,
      action:    "EXPORT",
      status:    "failed",
      source:    "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { exportBlotter };