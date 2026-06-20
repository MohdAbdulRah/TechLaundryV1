const express = require("express");

const router = express.Router();


const {
  getAllUsersAnalytics,
  getAdminDashboardOverview
} = require("../../Controllers/Admin/usersController");

router.get(
  "/user/analytics",
  getAllUsersAnalytics
);
router.get(
  "/user/dashboard",
  getAdminDashboardOverview
);

module.exports = router;