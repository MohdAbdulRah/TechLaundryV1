const express = require("express")

const router = express.Router()
const {allShops,viewShop,getServiceOfShop,getAllCategories, getMyAnalytics} = require("../../Controllers/General/generalController")


router.get("/all/shops",allShops)
router.get("/shop/:shopId",viewShop)

router.get("/shop/service/:shopId",getServiceOfShop)
router.get("/get/categories",getAllCategories)
router.get("/get/Profile",getMyAnalytics)

module.exports = router