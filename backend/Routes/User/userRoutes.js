const express = require("express")

const router = express.Router()
const {login,signup,addLocation,getLocation,updateLiveLocation} = require("../../Controllers/User/userController")
const  {authMiddleware} = require("../../middlewares/authMiddleWare")

router.post("/login",login)
router.post("/signup",signup)

router.post("/addLocation",authMiddleware,addLocation)

router.get("/getLocation",authMiddleware,getLocation)
router.post(
  "/updateLiveLocation",
  authMiddleware,
  updateLiveLocation
)

module.exports = router