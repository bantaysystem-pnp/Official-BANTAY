// backend\features\cases\routes\suspectApprehendedRoutes.js
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

// Read + create are open to any authenticated role (case-update dropdown and
// "+ Others, please specify" both need them); rename/deactivate/restore are Admin-only
router.get("/", authenticate, getMethods);
router.post("/", authenticate, createMethod);
router.patch("/:id", authenticate, requireAdmin, updateMethod);
router.patch("/:id/deactivate", authenticate, requireAdmin, deactivateMethod);
router.patch("/:id/restore", authenticate, requireAdmin, restoreMethod);

module.exports = router;