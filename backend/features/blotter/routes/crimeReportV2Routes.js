// backend\features\blotter\routes\crimeReportV2Routes.js

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");
const upload = require("../middleware/uploadMiddleware");

const {
  createCrimeReport,
  getAllCrimeReports,
  getCrimeReportById,
  updateCrimeReport,
  deleteCrimeReport,
  getDeletedCrimeReports,
  restoreCrimeReport,
  getModusByCrimeType,
  importCrimeReports,
} = require("../controllers/crimeReportV2Controller");
const { exportBlotter } = require("../controllers/exportBlotterController");

// ✅ Static routes BEFORE /:id
router.get("/deleted/all", authenticate, getDeletedCrimeReports);
router.get("/modus/:crimeType", authenticate, getModusByCrimeType);
router.post("/import", authenticate, upload.single("file"), importCrimeReports);
router.post("/export", authenticate, exportBlotter);

router.post("/", authenticate, createCrimeReport);
router.get("/", authenticate, getAllCrimeReports);

// ── /:id routes ──
router.get("/:id", authenticate, getCrimeReportById);
router.put("/:id", authenticate, updateCrimeReport);
router.delete("/:id", authenticate, deleteCrimeReport);
router.put("/:id/restore", authenticate, restoreCrimeReport);

module.exports = router;