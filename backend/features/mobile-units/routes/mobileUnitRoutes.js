const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");

// Requires `authenticate` to have already run and set req.user.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "Administrator") {
    return res.status(403).json({
      success: false,
      message: "Administrator access required",
    });
  }
  next();
};

const {
  getAllMobileUnits,
  createMobileUnit,
  updateMobileUnit,
} = require("../controllers/mobileUnitController");

// Read + create are open to any authenticated role (blotter form's dropdown
// and "+ Others, please specify" both need them); edit/deactivate/restore
// stay Admin-only, reachable only from Mobile Unit Management
router.get("/", authenticate, getAllMobileUnits);
router.post("/", authenticate, createMobileUnit);
router.patch("/:id", authenticate, requireAdmin, updateMobileUnit);

module.exports = router;