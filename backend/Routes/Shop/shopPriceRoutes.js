const express = require("express")
const { addPrice,updatePrice ,deletePrice,viewPrice,viewAllPrices,getShopId, getShopOverview} = require("../../Controllers/Shop/shopPriceController")

const router = express.Router()

router.get("/view/:shopId",viewAllPrices)
router.get("/getShop",getShopId)
router.get("/view/:shopId/price/:priceId", viewPrice);
router.post("/add/:shopId",addPrice)
router.put("/update/:shopId/:priceId",updatePrice);
router.delete("/delete/:shopId/:priceId",  deletePrice);
router.get("/overview",getShopOverview)

module.exports = router