// backend/features/blotter/controllers/exportBlotterController.js
// Generates an Excel export of blotter records, using the same header
// layout as the import template — so an exported file can be re-imported
// as-is, and duplicates get caught by the report_number unique constraint.

const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");
const XLSX = require("xlsx");

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

function buildBlotterExcel(records, meta = {}) {
  const rows = records.map((r) => {
    const { date, time } = splitDateTime(r.date_time_commission);
    return {
      "Report Number": r.report_number || "",
      stageOfFelony: r.stage_of_felony || "",
      barangay: r.place_barangay || "",
      DATE: date,
      TIME: time,
      offense: r.crime_type || "",
      typeofOperation: r.type_of_operation || "",
      // Export the NAME, not the id — findOrCreateModus / findOrCreateTypeOfOperation /
      // MobileUnit.findOrCreate on re-import resolve by name, same as manual entry.
      modus: r.modus_name || "",
      lat: r.lat ?? "",
      lng: r.lng ?? "",
      casestatus: r.status || r.case_status || "",
      "Assigned Mobile Unit": r.assigned_mobile_name || "",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: EXPORT_HEADERS });
  worksheet["!cols"] = COLUMN_WIDTHS;

  // Sheet tab name follows the "cy <year>" convention from the reference
  // template, based on the export's date range.
  const year = meta.dateFrom ? new Date(meta.dateFrom).getFullYear() : new Date().getFullYear();
  const sheetName = `cy ${year}`;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

const exportBlotter = async (req, res) => {
  try {
    const { records = [], meta = {} } = req.body;

    const excelBuffer = buildBlotterExcel(records, meta);

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