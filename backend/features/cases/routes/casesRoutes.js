// backend\features\cases\routes\casesRoutes.js
const router = require("express").Router();
const { authenticate } = require("../../../shared/middleware/tokenMiddleware");
const {
  assignInvestigator,
  updateStatus,
  updatePriority,
  updateSuspectApprehended,
  getCases,
  getCaseById,
  addNote,
  editNote,
  deleteNote,
  restoreNote,
  getStatistics,
} = require("../controllers/casesController");
const requireAdmin = (req, res, next) => {
  if (req.user.role !== "Administrator")
    return res.status(403).json({ success: false, message: "Access denied" });
  next();
};

router.get("/statistics", authenticate, requireAdmin, getStatistics);
router.patch("/notes/:noteId/restore", authenticate, requireAdmin, restoreNote);
router.patch("/notes/:noteId", authenticate, editNote);
router.delete("/notes/:noteId", authenticate, deleteNote);
router.get("/", authenticate, getCases);
router.get("/:id", authenticate, getCaseById);

router.patch("/:id/assign", authenticate, requireAdmin, assignInvestigator);
router.patch("/:id/status", authenticate, updateStatus);
router.post("/:id/notes", authenticate, addNote);
router.patch("/:id/priority", authenticate, updatePriority);
router.patch(
  "/:id/suspect-apprehended",
  authenticate,
  requireAdmin,
  updateSuspectApprehended,
);
module.exports = router;
