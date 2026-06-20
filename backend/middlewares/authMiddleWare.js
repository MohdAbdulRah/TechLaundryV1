const jwt = require("jsonwebtoken");
const { createResponse } = require("../utils/Response");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(
        res,
        401,
        "Access Denied. No token provided",
        null,
        false
      );
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // Attach user data to request
    req.user = decoded;
    console.log(req.user);
    next();

  } catch (err) {
    return createResponse(
      res,
      401,
      "Invalid or Expired Token",
      null,
      false
    );
  }
};
const shopMiddleWare = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(
        res,
        401,
        "Access Denied. No token provided",
        null,
        false
      );
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // Attach user data to request
    req.user = decoded;
    console.log(req.user);
    if(req.user.role == "shopOwner") next();
    else createResponse(
      res,
      401,
      "Not Authorized - You are not a Shop Owner",
      null,
      false
    );

  } catch (err) {
    return createResponse(
      res,
      401,
      "Invalid or Expired Token",
      null,
      false
    );
  }
};
const deliveryBoyMiddleware = async ( req,res,next) => {
  try {

    // ─── Get Token ───────────────────────
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {

      return createResponse(
        res,
        401,
        "Access Denied. No token provided",
        null,
        false
      );

    }

    // ─── Extract Token ───────────────────
    const token =
      authHeader.split(" ")[1];

    // ─── Verify Token ────────────────────
    const decoded = jwt.verify(
      token,
      process.env.SECRET_KEY
    );

    // ─── Attach User ─────────────────────
    req.user = decoded;

    console.log(req.user);

    // ─── Role Check ──────────────────────
    if (
      req.user.role === "deliveryBoy"
    ) {

      next();

    } else {

      return createResponse(
        res,
        401,
        "Not Authorized - You are not a Delivery Boy",
        null,
        false
      );

    }

  } catch (err) {

    return createResponse(
      res,
      401,
      "Invalid or Expired Token",
      null,
      false
    );

  }
};
const adminMiddleWare = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    // Check if token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return createResponse(
        res,
        401,
        "Access Denied. No token provided",
        null,
        false
      );
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    // Attach user data to request
    req.user = decoded;
    console.log(req.user);
    if(req.user.role == "admin") next();
    else createResponse(
      res,
      401,
      "Not Authorized - You are not a Shop Owner",
      null,
      false
    );

  } catch (err) {
    return createResponse(
      res,
      401,
      "Invalid or Expired Token",
      null,
      false
    );
  }
};
module.exports = {authMiddleware,shopMiddleWare,adminMiddleWare,deliveryBoyMiddleware};