const express = require("express");

const router = express.Router();


const {
  getAllShopsAnalytics
} = require("../../Controllers/Admin/shopsController");

router.get(
  "/shops/analytics",
  getAllShopsAnalytics
);

module.exports = router;