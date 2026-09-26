// backend\features\blotter\routes\crimeReportV2Routes.js

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");
const upload = require("../middleware/uploadMiddleware");

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "Administrator")
    return res.status(403).json({ success: false, message: "Access denied" });
  next();
};

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
  createModusForCrimeType,
  getTypeOfOperationOptions,
  createTypeOfOperationEntry,
} = require("../controllers/crimeReportV2Controller");
const { exportBlotter } = require("../controllers/exportBlotterController");
// ✅ Static routes BEFORE /:id
router.get("/deleted/all", authenticate, requireAdmin, getDeletedCrimeReports);
router.get("/modus/:crimeType", authenticate, getModusByCrimeType);
router.get("/type-of-operation", authenticate, getTypeOfOperationOptions); // MOVED UP
router.post("/type-of-operation", authenticate, createTypeOfOperationEntry); // MOVED UP
router.post("/modus", authenticate, createModusForCrimeType); // MOVED UP
router.post("/import", authenticate, upload.single("file"), importCrimeReports);
router.post("/export", authenticate, exportBlotter);

router.post("/", authenticate, createCrimeReport);
router.get("/", authenticate, getAllCrimeReports);

// ── /:id routes (must come LAST) ──
router.get("/:id", authenticate, getCrimeReportById);
router.put("/:id", authenticate, updateCrimeReport);
router.delete("/:id", authenticate, requireAdmin, deleteCrimeReport);
router.put("/:id/restore", authenticate, requireAdmin, restoreCrimeReport);

module.exports = router;