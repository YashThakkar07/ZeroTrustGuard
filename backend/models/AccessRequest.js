const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const AccessRequest = sequelize.define("AccessRequest", {

  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  fileId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },

  reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },

  status: {
    type: DataTypes.ENUM("pending","approved","rejected"),
    defaultValue: "pending"
  },

  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  }

});

module.exports = AccessRequest;