const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

// Get activity logs
exports.getLogs = async (req, res) => {
  try {
    // Check if admin/super_admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied." });
    }

    // Return last 100 logs ordered by newest
    const logs = await ActivityLog.findAll({
      include: [{
        model: User,
        attributes: ["id", "email", "name", "department"]
      }],
      order: [["createdAt", "DESC"]],
      limit: 100
    });

    res.status(200).json({
      message: "Activity logs fetched successfully",
      logs
    });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    res.status(500).json({
      message: "Failed to fetch activity logs"
    });
  }
};
