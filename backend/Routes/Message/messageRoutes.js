const express = require("express");
const router = express.Router();

const {
  addMessage,
  getUserMessages,
} = require("../../Controllers/Message/messageController");

// middleware assumed: req.user is already set
router.post("/messages", addMessage);

router.get("/messages", getUserMessages);

module.exports = router;