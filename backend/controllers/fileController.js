const File = require("../models/File");
const User = require("../models/User");
const TemporaryAccess = require("../models/TemporaryAccess");
const ActivityLog = require("../models/ActivityLog");
const AccessRequest = require("../models/AccessRequest");
const { Op } = require("sequelize");
const path = require("path");

// Upload File
exports.uploadFile = async (req, res) => {
  try {
    console.log("--- START UPLOAD FILE ROUTE ---");

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded"
      });
    }

    const userId = req.user ? req.user.id : null;
    const role = req.user ? req.user.role : null;

    let allowedRoles = ["admin"]; // Admin always has access

    // Extract payload preferences
    const payloadAllowIntern = req.body.allowIntern === "true";
    const payloadAllowStaff = req.body.allowStaff === "true";
    const payloadAllowSenior = req.body.allowSenior === "true";
    let sensitivityLevel = req.body.sensitivityLevel || "low";

    // Enforce Strict Matrix
    if (role === "intern") {
      // Intern: Forces all roles to have access. Forces sensitivity to low.
      allowedRoles.push("intern", "staff", "senior");
      sensitivityLevel = "low";
    } else if (role === "staff") {
      // Staff: Forces staff & senior. Optional intern. No critical.
      allowedRoles.push("staff", "senior");
      if (payloadAllowIntern) allowedRoles.push("intern");
      if (sensitivityLevel === "critical") sensitivityLevel = "high";
    } else if (role === "senior") {
      // Senior: Forces senior. Optional intern & staff. Any sensitivity.
      allowedRoles.push("senior");
      if (payloadAllowIntern) allowedRoles.push("intern");
      if (payloadAllowStaff) allowedRoles.push("staff");
    } else if (role === "admin" || role === "super_admin") {
      // Admin: Optional intern, staff, senior. Any sensitivity.
      if (payloadAllowIntern) allowedRoles.push("intern");
      if (payloadAllowStaff) allowedRoles.push("staff");
      if (payloadAllowSenior) allowedRoles.push("senior");
    }

    const user = await User.findByPk(userId);
    const department = user ? user.department : null;

    // Create file
    const createdFile = await File.create({
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadedBy: userId,
      allowedRoles,
      sensitivityLevel,
      department
    });

    const file = await File.findByPk(createdFile.id, {
      include: [
        {
          model: User,
          attributes: ["id", "email", "role"]
        }
      ]
    });

    // Log action
    await ActivityLog.create({
      userId,
      action: "file_upload",
      fileId: createdFile.id,
      department: department,
      resource: req.file.filename,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({
      message: "File uploaded successfully",
      file
    });

  } catch (error) {

    console.error("Upload error:", error);

    res.status(500).json({
      message: "File upload failed",
      error: error.message,
      stack: error.stack
    });

  }
};

// Get all files (admin only)
exports.getAllFiles = async (req, res) => {
  try {
    // Check if admin
    if (req.user.role !== "admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const files = await File.findAll({
      include: [
        {
          model: User,
          attributes: ["id", "email", "name", "role", "department"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.status(200).json({
      message: "Files fetched successfully",
      files
    });
  } catch (error) {
    console.error("Fetch all files error:", error);
    res.status(500).json({
      message: "Failed to fetch files"
    });
  }
};

exports.getMyFiles = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const userDept = user.department;
    const userRole = user.role;

    // If user has no department assigned, return empty list gracefully
    if (!userDept) {
      return res.status(200).json({ message: "Files fetched successfully", files: [] });
    }

    const files = await File.findAll({
      where: { department: userDept },
      include: [
        {
          model: User,
          attributes: ["id", "email", "role"]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const now = new Date();
    const fileIds = files.map(f => f.id);
    let tempAccesses = [];
    
    if (fileIds.length > 0) {
      tempAccesses = await TemporaryAccess.findAll({
        where: {
          userId,
          fileId: { [Op.in]: fileIds },
          expiresAt: { [Op.gt]: now }
        }
      });
    }

    const tempAccessMap = new Set(tempAccesses.map(ta => ta.fileId));

    const enrichedFiles = files.map(f => {
      let canView = false;
      let canDownload = false;

      // Priority 1: Admin
      if (userRole === "admin" || userRole === "super_admin") {
        canView = true;
        canDownload = true;
      } 
      // Priority 2: Role-based access
      else if (f.allowedRoles && f.allowedRoles.includes(userRole)) {
        canView = true;
        canDownload = true;
      }

      const tempAccess = tempAccesses.find(ta => ta.fileId === f.id);
      if (tempAccess) {
        canView = canView || tempAccess.canView;
        canDownload = canDownload || tempAccess.canDownload;
      }

      return {
        ...f.toJSON(),
        canView,
        canDownload
      };
    });

    res.status(200).json({
      message: "Files fetched successfully",
      files: enrichedFiles
    });

  } catch (error) {
    console.error("Fetch files error:", error);
    res.status(500).json({ message: "Failed to fetch files", error: error.message, stack: error.stack });
  }
};

// Download File
exports.downloadFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    const mfaPin = req.headers["x-mfa-pin"];

    const user = await User.findByPk(userId);
    const file = await File.findByPk(fileId);

    if (!file || !user) {
      return res.status(404).json({ message: "Not found" });
    }

    if (user.mfaEnabled) {
      if (!mfaPin) {
        return res.status(403).json({ mfaRequired: true, message: "MFA PIN required for download." });
      }
      const bcrypt = require("bcrypt");
      const isPinValid = await bcrypt.compare(mfaPin, user.mfaPin);
      if (!isPinValid) {
        return res.status(403).json({ mfaRequired: true, message: "Invalid MFA PIN." });
      }
    }

    let canDownload = false;
    const userRole = user.role;

    if (userRole === "admin" || userRole === "super_admin") {
      canDownload = true;
    } else if (file.allowedRoles && file.allowedRoles.includes(userRole)) {
      canDownload = true;
    }

    if (!canDownload) {
      const tempAccess = await TemporaryAccess.findOne({
        where: {
          userId,
          fileId,
          expiresAt: { [Op.gt]: new Date() },
          canDownload: true
        }
      });
      if (tempAccess) canDownload = true;
    }

    if (!canDownload) {
      return res.status(403).json({ message: "Access denied for downloading" });
    }

    // Log action
    await ActivityLog.create({
      userId,
      action: "file_download",
      fileId,
      department: user.department,
      resource: file.filename,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    // Handle relative or absolute paths appropriately
    let filePath = file.path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(__dirname, "..", filePath);
    }
    
    res.download(filePath, file.originalName || file.filename);

  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Download failed" });
  }
};

// Request Access
exports.requestAccess = async (req, res) => {
  try {
    const { fileId, reason } = req.body;
    const userId = req.user.id;
    
    const user = await User.findByPk(userId);
    const file = await File.findByPk(fileId);

    if (!file) return res.status(404).json({ message: "File not found" });

    // Ensure user doesn't already have direct access
    if (user.role === "admin" || user.role === "super_admin" || (file.allowedRoles && file.allowedRoles.includes(user.role))) {
      return res.status(400).json({ message: "Already has access" });
    }

    const existingRequest = await AccessRequest.findOne({ where: { userId, fileId, status: "pending" } });
    if (existingRequest) {
      return res.status(400).json({ message: "Request already pending for this file" });
    }

    await AccessRequest.create({
      userId,
      fileId,
      reason,
      status: "pending"
    });

    await ActivityLog.create({
      userId,
      action: "access_request",
      fileId,
      department: user ? user.department : null,
      resource: fileId.toString(),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"]
    });

    res.status(201).json({ message: "Access requested successfully" });
  } catch (error) {
    console.error("Request access error:", error);
    res.status(500).json({ message: "Request failed" });
  }
};

// View File
// ... (keep your imports at the top)

exports.viewFile = async (req, res) => {
  try {
    const fileId = req.params.id;
    const userId = req.user.id;
    const mfaPin = req.headers["x-mfa-pin"];

    const user = await User.findByPk(userId);
    const file = await File.findByPk(fileId);

    if (!file || !user) return res.status(404).json({ message: "Not found" });

    // MFA Check
    if (user.mfaEnabled) {
      if (!mfaPin) return res.status(403).json({ mfaRequired: true, message: "MFA PIN required." });
      const bcrypt = require("bcrypt");
      const isPinValid = await bcrypt.compare(mfaPin, user.mfaPin);
      if (!isPinValid) return res.status(403).json({ mfaRequired: true, message: "Invalid MFA PIN." });
    }

    // Access Control Logic
    let canView = (user.role === "admin" || user.role === "super_admin" || (file.allowedRoles && file.allowedRoles.includes(user.role)));

    if (!canView) {
      const tempAccess = await TemporaryAccess.findOne({
        where: { userId, fileId, expiresAt: { [Op.gt]: new Date() }, canView: true }
      });
      if (tempAccess) canView = true;
    }

    if (!canView) return res.status(403).json({ message: "Access denied" });

    // Log the view action
    await ActivityLog.create({
      userId,
      action: "file_view",
      fileId,
      department: user.department,
      resource: file.filename,
      riskScore: 0 // Normal activity
    });

    let filePath = file.path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(__dirname, "..", filePath);
    }

    // THE FIX: Set headers before sending
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + file.originalName + '"');
    
    res.sendFile(filePath);

  } catch (error) {
    console.error("View error:", error);
    res.status(500).json({ message: "Viewing failed" });
  }
};
