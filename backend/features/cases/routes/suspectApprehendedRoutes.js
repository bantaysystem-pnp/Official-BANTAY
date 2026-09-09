const router = require("express").Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");
const {
  getMethods,
  createMethod,
  updateMethod,
  deactivateMethod,
  restoreMethod,
} = require("../controllers/suspectApprehendedController");

const requireAdmin = (req, res, next) => {
  if (!["Administrator", "Technical Administrator"].includes(req.user.role))
    return res.status(403).json({ success: false, message: "Access denied" });
  next();
};

// Read is open to any authenticated role (dropdowns need it); writes are Admin-only
router.get("/", authenticate, getMethods);
router.post("/", authenticate, requireAdmin, createMethod);
router.patch("/:id", authenticate, requireAdmin, updateMethod);
router.patch("/:id/deactivate", authenticate, requireAdmin, deactivateMethod);
router.patch("/:id/restore", authenticate, requireAdmin, restoreMethod);

module.exports = router;