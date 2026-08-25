// backend\features\blotter\utils\importUtils.js

const { normalizeBarangay } = require("../../../shared/utils/barangays");

const OFFENSE_MAP = {
  "NEW ANTI-CARNAPPING ACT OF 2016 - MC": "CARNAPPING - MC",
  "NEW ANTI-CARNAPPING ACT OF 2016 - MV": "CARNAPPING - MV",
  "CARNAPPING MC": "CARNAPPING - MC",
  "CARNAPPING MV": "CARNAPPING - MV",
  "PHYSICAL INJURIES": "Physical Injury",
  "PHYSICAL INJURY": "Physical Injury",
  "MURDER": "Murder",
  "HOMICIDE": "Homicide",
  "RAPE": "Rape",
  "ROBBERY": "Robbery",
  "THEFT": "Theft",
};


function normalizeOffense(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase();
  // Direct map check
  if (OFFENSE_MAP[cleaned]) return OFFENSE_MAP[cleaned];
  // Partial match fallback
  if (cleaned.includes("CARNAPPING") && cleaned.includes("MC")) return "CARNAPPING - MC";
  if (cleaned.includes("CARNAPPING") && cleaned.includes("MV")) return "CARNAPPING - MV";
  if (cleaned.includes("PHYSICAL INJ")) return "Physical Injury";
  if (cleaned === "MURDER") return "Murder";
  if (cleaned === "HOMICIDE") return "Homicide";
  if (cleaned === "RAPE") return "Rape";
  if (cleaned === "ROBBERY") return "Robbery";
  if (cleaned === "THEFT") return "Theft";
  return null; // unrecognized → flag
}




function deriveFromDate(dateValue) {
  if (!dateValue) return { dayOfWeek: null, monthName: null };
  let date;
  // Handle Excel serial date numbers
  if (typeof dateValue === "number") {
    date = new Date((dateValue - 25569) * 86400 * 1000);
  } else {
    date = new Date(dateValue);
  }
  if (isNaN(date.getTime())) return { dayOfWeek: null, monthName: null };
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return {
    dayOfWeek: days[date.getDay()],
    monthName: months[date.getMonth()],
  };
}

module.exports = { normalizeOffense, normalizeBarangay, deriveFromDate };