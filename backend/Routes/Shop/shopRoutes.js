const express = require("express")
const { addShop,updateShop ,deleteShop, getMyShopOrders, getOtpForShopOwner, markServiceDone, addDeliveryBoyForShopToCollect, getValidOtpForCollectionFromShop,getShopDetails,getShopOwnerProfile} = require("../../Controllers/Shop/shopController")

const router = express.Router()

router.post("/add",addShop)
router.get("/orders",getMyShopOrders)
router.put("/update/:shopId",updateShop);
router.delete("/delete/:shopId",  deleteShop);
router.post("/get/otp/collected_from_user",getOtpForShopOwner)
router.patch("/mark-service-done",markServiceDone)
router.post("/assign-delivery-boy",addDeliveryBoyForShopToCollect)
router.get("/details", getShopDetails);
router.get(
  "/get/Profile",
  getShopOwnerProfile
);
router.get(
  "/get-valid-otp-for-collection-from-shop/:deliveryId",getValidOtpForCollectionFromShop);

module.exports = router