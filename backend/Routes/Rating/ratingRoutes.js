const express = require("express")
const {giveRating,deleteRating} = require("../../Controllers/Rating/ratingController")
const router = express.Router()

router.post(
  "/give",
  giveRating
);



router.delete(
  "/delete",
  deleteRating
);


module.exports = router