const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const securityController = require("../controllers/securityController");

// Route: GET /api/security/alerts
// Desc: Get all security alerts (Admin only)
router.get("/alerts", authMiddleware, securityController.getAlerts);

// Route: PATCH /api/security/alerts/:id/resolve
// Desc: Resolve a security alert (Admin only)
router.patch("/alerts/:id/resolve", authMiddleware, securityController.resolveAlert);

module.exports = router;
