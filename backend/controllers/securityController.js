const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");
const { Op } = require("sequelize");

// Get security alerts (riskScore >= 70)
exports.getAlerts = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const alerts = await ActivityLog.findAll({
      where: {
        riskScore: { [Op.gte]: 70 },
        // Only show alerts that haven't been resolved yet
        status: { [Op.ne]: 'RESOLVED' } 
      },
      include: [{
        model: User,
        attributes: ["id", "email", "name", "department"]
      }],
      order: [["createdAt", "DESC"]],
      limit: 100
    });

    // Ensure we always return an array even if empty
    res.status(200).json({
      message: "Security alerts fetched successfully",
      alerts: alerts || []
    });
  } catch (error) {
    console.error("Fetch security alerts error:", error);
    res.status(500).json({ message: "Failed to fetch security alerts", alerts: [] });
  }
};

// Resolve Alert
exports.resolveAlert = async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const { id } = req.params;
    const alert = await ActivityLog.findByPk(id);

    if (!alert) return res.status(404).json({ message: "Alert not found" });

    // Syncing with the frontend "RESOLVED" status
    alert.status = "RESOLVED";
    alert.resolved = true; 
    alert.resolvedBy = req.user.id;
    
    await alert.save();

    res.status(200).json({ message: "Alert resolved successfully", alert });
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ message: "Failed to resolve alert" });
  }
};