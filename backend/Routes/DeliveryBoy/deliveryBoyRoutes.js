const express = require("express")
const { getDeliveryBoyProfile, updateAvail } = require("../../Controllers/DeliveryBoy/deliveryBoyController")

const router = express.Router()

router.get(
  "/delivery-boy/profile",
  getDeliveryBoyProfile
)

router.post(
  "/delivery-boy/avail",
  updateAvail
)

module.exports = router
