// backend\features\type-of-operation\routes\typeOfOperationRoutes.js
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
  getAllTypeOfOperation,
  getTypeOfOperationById,
  createTypeOfOperation,
  updateTypeOfOperation,
} = require("../controllers/typeOfOperationController");

router.get("/", authenticate, requireAdmin, getAllTypeOfOperation);
router.get("/:id", authenticate, requireAdmin, getTypeOfOperationById);
router.post("/", authenticate, requireAdmin, createTypeOfOperation);
router.patch("/:id", authenticate, requireAdmin, updateTypeOfOperation);

module.exports = router;