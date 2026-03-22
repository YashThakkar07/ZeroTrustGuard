const User = require("../models/User");
const File = require("../models/File");
const AccessRequest = require("../models/AccessRequest");
const ActivityLog = require("../models/ActivityLog");
const { Op } = require("sequelize");

// Get stats
exports.getStats = async (req, res) => {
  try {
    // Check if admin/super_admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    const totalUsers = await User.count();
    const totalFiles = await File.count();
    const totalRequests = await AccessRequest.count();
    const totalAlerts = await ActivityLog.count({
      where: {
        riskScore: { [Op.gte]: 70 }
      }
    });

    res.status(200).json({
      totalUsers,
      totalFiles,
      totalRequests,
      totalAlerts
    });
  } catch (error) {
    console.error("Fetch dashboard stats error:", error);
    res.status(500).json({
      message: "Failed to fetch dashboard stats"
    });
  }
};
