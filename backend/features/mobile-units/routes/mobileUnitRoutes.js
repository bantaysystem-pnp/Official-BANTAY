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

router.get("/", authenticate, requireAdmin, getAllMobileUnits);
router.post("/", authenticate, requireAdmin, createMobileUnit);
router.patch("/:id", authenticate, requireAdmin, updateMobileUnit);

module.exports = router;