const express = require("express")

const { createDelivery, getDeliveryBoyDeliveries, getUserDeliveries,getOtpForDelivery, getOtpForGiveToUser ,getCompletedDeliveriesOfDeliveryBoy} = require("../../Controllers/Delivery/deliveryController")

const router = express.Router()

router.post("/create",createDelivery)
router.get("/all-deliveries",getDeliveryBoyDeliveries)
router.get("/user",getUserDeliveries)
router.post(
    "/get-otp-started",
    getOtpForDelivery
);
router.post("/get-otp-for-give-to-user",getOtpForGiveToUser)
router.get(
  "/get-completed-deliveries-of-delivery-boy",
 
  getCompletedDeliveriesOfDeliveryBoy
);
module.exports = router
