const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");

const {
  getAllMobileUnits,
  createMobileUnit,
  updateMobileUnit,
} = require("../controllers/mobileUnitController");

router.get("/", authenticate, getAllMobileUnits);
router.post("/", authenticate, createMobileUnit);
router.patch("/:id", authenticate, updateMobileUnit);

module.exports = router;