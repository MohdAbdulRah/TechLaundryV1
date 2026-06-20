const { Message } = require("../../Models/Message/Message");
const User = require("../../Models/User/User");

const addMessage = async (req, res) => {
  try {
    const authUser = req.user;

    if (!authUser) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const currUser = await User.findById(authUser.id);

    if (!currUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { role, text } = req.body;

    if (!role || !text) {
      return res.status(400).json({
        success: false,
        message: "role and text are required",
      });
    }

    const message = await Message.create({
      user: currUser._id,
      role,
      text,
    });

    return res.status(201).json({
      success: true,
      message: "Message saved successfully",
      data: message,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
const getUserMessages = async (req, res) => {
  try {
    const authUser = req.user;

    if (!authUser) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const messages = await Message.find({
      user: authUser.id,
    }).sort({ createdAt: 1 }); // chat order

    return res.status(200).json({
      success: true,
      message: "Messages fetched successfully",
      data: messages,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  addMessage,
  getUserMessages,
};
