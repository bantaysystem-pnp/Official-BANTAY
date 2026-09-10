// backend\features\type-of-operation\routes\typeOfOperationRoutes.js

const express = require("express");
const router = express.Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");
const {
  getAllTypeOfOperation,
  getTypeOfOperationById,
  createTypeOfOperation,
  updateTypeOfOperation,
} = require("../controllers/typeOfOperationController");

router.get("/", authenticate, getAllTypeOfOperation);
router.get("/:id", authenticate, getTypeOfOperationById);
router.post("/", authenticate, createTypeOfOperation);
router.patch("/:id", authenticate, updateTypeOfOperation);

module.exports = router;