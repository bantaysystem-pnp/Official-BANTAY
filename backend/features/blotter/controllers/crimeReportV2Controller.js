// backend\features\blotter\controllers\crimeReportV2Controller.js

const CrimeReportV2 = require("../models/CrimeReportV2");
const { logAudit, getClientIp } = require("../../../shared/utils/auditLogger");
const XLSX = require("xlsx");
const { normalizeOffense, deriveFromDate } = require("../utils/importUtils");
const { normalizeBarangay, VALID_BARANGAYS } = require("../../../shared/utils/barangays");


const VALID_CRIME_TYPES = [
  "Carnapping - MC", "Carnapping - MV", "Homicide", "Murder",
  "Physical Injury", "Rape", "Robbery", "Special Complex Crime", "Theft",
];

const VALID_TYPE_OF_PLACE = [
  "Abandoned Structure (house, bldg, apartment/condo)",
  "Along the street",
  "Commercial/Business Establishment",
  "Construction/Industrial Barracks",
  "Farm/Ricefield",
  "Government Office/Establishment",
  "Onboard a vehicle (riding in/on)",
  "Parking Area (vacant lot, in bldg/structure, open parking)",
  "Recreational Place (resorts/parks)",
  "Residential (house/condo)",
  "River/Lake",
  "School (Grade/High School/College/University)",
  "Transportation Terminals (Tricycle, Jeep, FX, Bus, Train Station)",
  "Vacant Lot (unused/unoccupied open area)",
];

const OFFENSE_TO_MODUS_CRIME_TYPE = {
  Murder: "MURDER",
  Homicide: "HOMICIDE",
  "Physical Injury": "PHYSICAL INJURIES",
  Rape: "RAPE",
  Robbery: "ROBBERY",
  Theft: "THEFT",
  "Carnapping - MC": "CARNAPPING - MC",
  "Carnapping - MV": "CARNAPPING - MV",
  "Special Complex Crime": "SPECIAL COMPLEX CRIME",
};

const validateReportData = (data) => {
  const errors = [];
  if (!data.crime_type) errors.push("Crime Type is required");
  else if (!VALID_CRIME_TYPES.includes(data.crime_type))
    errors.push("Invalid Crime Type");

  if (!data.date_time_commission)
    errors.push("Date & Time of Commission is required");
  if (!data.date_time_reported)
    errors.push("Date & Time Reported is required");

  if (data.date_time_commission && data.date_time_reported) {
    const commission = new Date(data.date_time_commission);
    const reported = new Date(data.date_time_reported);
    const now = new Date();
    const futureLimit = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (commission > futureLimit) errors.push("Commission date cannot be in the future");
    if (reported > futureLimit) errors.push("Report date cannot be in the future");
    if (commission > reported) errors.push("Commission date cannot be after report date");
  }

  if (!data.place_barangay) errors.push("Barangay is required");

  return errors;
};

const createCrimeReport = async (req, res) => {
  try {
    const errors = validateReportData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const result = await CrimeReportV2.create(req.body, req.user.user_id);

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Crime Report Created (v2)",
      description: `Created crime report "${result.report_number}" for "${req.body.crime_type}"`,
      action: "CREATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(201).json({
      success: true,
      message: "Crime report created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Create crime report v2 error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating crime report",
      error: error.message,
    });
  }
};

const getAllCrimeReports = async (req, res) => {
  try {
    const filters = {
      search: req.query.search,          // ← add this line
      crime_type: req.query.crime_type,
      status: req.query.status,
      barangay: req.query.barangay,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };
    const reports = await CrimeReportV2.getAll(filters);
    res.status(200).json({ success: true, count: reports.length, data: reports });
  } catch (error) {
    console.error("Get crime reports v2 error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCrimeReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: "Invalid report ID" });
    }
    const report = await CrimeReportV2.getById(parsedId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Crime report not found" });
    }
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error("Get crime report v2 error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCrimeReport = async (req, res) => {
  try {
    const { id } = req.params;
    const errors = validateReportData(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const result = await CrimeReportV2.update(id, req.body);
    if (!result) {
      return res.status(404).json({ success: false, message: "Crime report not found" });
    }

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Crime Report Updated (v2)",
      description: `Updated crime report ID ${id}`,
      action: "UPDATE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(200).json({ success: true, message: "Crime report updated successfully", data: result });
  } catch (error) {
    console.error("Update crime report v2 error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCrimeReport = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await CrimeReportV2.softDelete(id);
    if (!result) {
      return res.status(404).json({ success: false, message: "Crime report not found" });
    }

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Crime Report Deleted (v2)",
      description: `Soft-deleted crime report ID ${id}`,
      action: "DELETE",
      status: "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(200).json({ success: true, message: "Crime report deleted successfully" });
  } catch (error) {
    console.error("Delete crime report v2 error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getDeletedCrimeReports = async (req, res) => {
  try {
    const reports = await CrimeReportV2.getDeleted();
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getModusByCrimeType = async (req, res) => {
  try {
    const { crimeType } = req.params;
    const modus = await CrimeReportV2.getModusByCrimeType(crimeType);
    res.status(200).json({ success: true, data: modus });
  } catch (error) {
    console.error("Get modus reference error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const restoreCrimeReport = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await CrimeReportV2.restore(id);
    if (!result) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, message: "Crime report restored successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const importCrimeReports = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      return res.status(200).json({
        success: false,
        message: "No records found to import",
      });
    }

    const firstRow = rows[0];
    const hasRequiredColumns =
      "DATE" in firstRow && "barangay" in firstRow && "offense" in firstRow;
    if (!hasRequiredColumns) {
      return res.status(200).json({
        success: false,
        message: "Invalid template — wrong or missing column headers",
      });
    }

    let inserted = 0;
    const errors = [];
    const duplicates = [];
    const seenReportNumbers = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // account for header row

      const crimeType = normalizeOffense(row.offense);
      if (!crimeType) {
        errors.push({ row: rowNum, field: "CRIME_TYPE", message: `Unrecognized offense: "${row.offense}"` });
        continue;
      }

      const barangay = normalizeBarangay(row.barangay);
      if (!barangay || !VALID_BARANGAYS.includes(barangay)) {
        errors.push({ row: rowNum, field: "BARANGAY", message: `Unrecognized barangay: "${row.barangay}"` });
        continue;
      }

      let dateTimeCommission = null;
      if (row.DATE) {
        const baseDate = row.DATE instanceof Date ? row.DATE : new Date(row.DATE);
        if (!isNaN(baseDate.getTime())) {
          if (row.TIME) {
            const timeMatch = String(row.TIME).match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2] || "0", 10);
              const meridian = timeMatch[3]?.toUpperCase();
              if (meridian === "PM" && hours < 12) hours += 12;
              if (meridian === "AM" && hours === 12) hours = 0;
              baseDate.setHours(hours, minutes, 0, 0);
            }
          }
          dateTimeCommission = baseDate;
        }
      }
      if (!dateTimeCommission) {
        errors.push({ row: rowNum, field: "DATE_COMMISSION", message: "Invalid or missing DATE" });
        continue;
      }

      const reportNumber = String(row["Report Number"] || "").trim();
      if (reportNumber) {
        if (seenReportNumbers.has(reportNumber)) {
          errors.push({ row: rowNum, field: "REPORT_NUMBER", message: `Duplicate Report Number in file: "${reportNumber}"` });
          continue;
        }
        seenReportNumbers.add(reportNumber);
      }

      const VALID_STAGES = ["CONSUMMATED", "ATTEMPTED", "FRUSTRATED"];
      let stageOfFelony = null;
      if (row.stageOfFelony) {
        const normalized = String(row.stageOfFelony).trim().toUpperCase();
        if (VALID_STAGES.includes(normalized)) {
          stageOfFelony = normalized;
        } else {
          errors.push({ row: rowNum, field: "STAGE_OF_FELONY", message: `Unrecognized Stage of Felony: "${row.stageOfFelony}"` });
        }
      }

      let typeOfPlace = null;
      const rawTypeOfPlace = String(row.typeofPlace || "").trim();
      if (rawTypeOfPlace) {
        typeOfPlace = VALID_TYPE_OF_PLACE.find(
          (t) => t.toLowerCase() === rawTypeOfPlace.toLowerCase(),
        );
      }
      if (!typeOfPlace) {
        errors.push({ row: rowNum, field: "TYPE_OF_PLACE", message: `Unrecognized Type of Place: "${row.typeofPlace}"` });
        continue;
      }

      let modusReferenceId = null;
      let modusCreated = false;
      const rawModus = String(row.modus || "").trim();
      if (rawModus) {
        const modusCrimeType = OFFENSE_TO_MODUS_CRIME_TYPE[crimeType];
        if (modusCrimeType) {
          const modusResult = await CrimeReportV2.findOrCreateModus(modusCrimeType, rawModus);
          modusReferenceId = modusResult.id;
          modusCreated = modusResult.created;
        }
      }

      const reportData = {
        report_number: reportNumber,
        crime_type: crimeType,
        stage_of_felony: stageOfFelony,
        modus_reference_id: modusReferenceId,
        date_time_commission: dateTimeCommission,
        date_time_reported: dateTimeCommission,
        place_barangay: barangay,
        type_of_place: typeOfPlace,
        lat: row.lat || null,
        lng: row.lng || null,
      };

      try {
        const result = await CrimeReportV2.create(reportData, req.user.user_id);
        if (row.casestatus) {
          await CrimeReportV2.setCaseStatus(result.report_id, String(row.casestatus).trim());
        }
        if (modusCreated) {
          await logAudit({
            userId: req.user?.user_id,
            username: req.user?.username,
            eventName: "Modus Auto-Created (Import)",
            description: `Created modus "${rawModus}" for ${OFFENSE_TO_MODUS_CRIME_TYPE[crimeType]}`,
            action: "CREATE",
            status: "success",
            source: "Web Portal",
            ipAddress: getClientIp(req),
          });
        }
        inserted++;
      } catch (err) {
        if (err.code === "23505") {
          duplicates.push({ row: rowNum, report_number: reportNumber });
        } else {
          errors.push({ row: rowNum, field: "OTHER", message: err.message });
        }
      }
    }

    await logAudit({
      userId: req.user?.user_id,
      username: req.user?.username,
      eventName: "Crime Reports Imported (v2)",
      description: `Imported ${inserted} of ${rows.length} rows`,
      action: "CREATE",
      status: errors.length || duplicates.length ? "partial" : "success",
      source: "Web Portal",
      ipAddress: getClientIp(req),
    });

    res.status(200).json({
      success: true,
      summary: {
        inserted,
        skipped_duplicates: duplicates.length,
        skipped_errors: errors.length,
        errors,
        duplicates,
      },
    });
  } catch (error) {
    console.error("Import crime reports v2 error:", error);
    res.status(500).json({ success: false, message: "Error importing crime reports", error: error.message });
  }
};

module.exports = {
  createCrimeReport,
  getAllCrimeReports,
  getCrimeReportById,
  updateCrimeReport,
  deleteCrimeReport,
  getDeletedCrimeReports,
  restoreCrimeReport,
  getModusByCrimeType,
  importCrimeReports,
};