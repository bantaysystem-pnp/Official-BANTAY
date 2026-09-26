// backend\features\modus\routes\modusRoutes.js
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
  getAllModus,
  getModusById,
  createModus,
  updateModus,
} = require("../controllers/modusController");

router.get("/", authenticate, requireAdmin, getAllModus);
router.get("/:id", authenticate, requireAdmin, getModusById);
router.post("/", authenticate, requireAdmin, createModus);
router.patch("/:id", authenticate, requireAdmin, updateModus);

module.exports = router;