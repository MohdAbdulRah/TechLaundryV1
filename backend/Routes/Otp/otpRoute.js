const express = require("express");

const router = express.Router();

const {
    createOtpCode,
    verifyOtpByDeliveryBoyForCollectionOfServices,
    createOtpForShopCollection,
    verifyOtpForShopCollection,
    createOtpForCollectionFromShop,
    verifyOtpForCollectionFromShop,
    createOtpForGiveToUser,
    verifyOtpForGiveToUser
} = require("../../Controllers/Otp/OtpController");

const {deliveryBoyMiddleware} = require("../../middlewares/authMiddleWare");

// ─── Create OTP ─────────────────────────────
router.post(
    "/create",
    deliveryBoyMiddleware,
    createOtpCode
);
router.post(
    "/verify-otp-collection-started",
    deliveryBoyMiddleware,
    verifyOtpByDeliveryBoyForCollectionOfServices
);

router.post(
    "/otp-for-shop-collection",
    deliveryBoyMiddleware,
    createOtpForShopCollection
)
router.post(
    "/verify-otp/shop-collection",
    deliveryBoyMiddleware,
    verifyOtpForShopCollection
)
router.post("/create-otp-for-collection-from-shop",deliveryBoyMiddleware,createOtpForCollectionFromShop)

router.post("/verify-otp-for-collection-from-shop",deliveryBoyMiddleware,verifyOtpForCollectionFromShop)

router.post("/create-otp-for-give-to-user",deliveryBoyMiddleware,createOtpForGiveToUser)

router.post("/verify-otp-for-give-to-user",deliveryBoyMiddleware,verifyOtpForGiveToUser)
module.exports = router;