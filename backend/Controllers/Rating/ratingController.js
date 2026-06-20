const Rating = require("../../Models/Shop/Rating");
const Shop = require("../../Models/Shop/Shop");
const User = require("../../Models/User/User");
const { createResponse } = require("../../utils/Response");


const giveRating = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Users
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "user"
    ) {

      return createResponse(
        res,
        403,
        "Only users can give ratings",
        null,
        false
      );

    }

    const {
      shopId,
      ratingNumber,
      comment
    } = req.body;

    // ─────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────

    if (!shopId) {

      return createResponse(
        res,
        400,
        "shopId is required",
        null,
        false
      );

    }

    if (
      !ratingNumber ||
      ratingNumber < 1 ||
      ratingNumber > 5
    ) {

      return createResponse(
        res,
        400,
        "Rating must be between 1 and 5",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Shop Exists
    // ─────────────────────────────────────────────

    const shop = await Shop.findById(shopId);

    if (!shop) {

      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Prevent Shop Owner Rating Own Shop
    // ─────────────────────────────────────────────

    const shopOwner = await User.findOne({
      role: "shopOwner",
      shop: shopId
    });

    if (
      shopOwner &&
      shopOwner._id.toString() === authUser.id
    ) {

      return createResponse(
        res,
        403,
        "You cannot rate your own shop",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Already Rated ?
    // ─────────────────────────────────────────────

    const existingRating =
      await Rating.findOne({
        shop: shopId,
        user: authUser.id
      });

    if (existingRating) {

      return createResponse(
        res,
        400,
        "You already rated this shop",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Create Rating
    // ─────────────────────────────────────────────

    const rating = await Rating.create({

      ratingNumber,

      comment,

      shop: shopId,

      user: authUser.id

    });

    // ─────────────────────────────────────────────
    // Update Shop Average
    // newAvg =
    // ((oldAvg * oldCount) + newRating)
    // / (oldCount + 1)
    // ─────────────────────────────────────────────

    const oldAvg = shop.rating || 0;

    const oldCount = shop.ratingCount || 0;

    const newAvg =
      (
        (oldAvg * oldCount) +
        ratingNumber
      ) /
      (oldCount + 1);

    shop.rating = Number(
      newAvg.toFixed(2)
    );

    shop.ratingCount = oldCount + 1;

    await shop.save();

    return createResponse(
      res,
      201,
      "Rating submitted successfully",
      rating,
      true
    );

  } catch (err) {

    console.error(err);

    return createResponse(
      res,
      500,
      err.message,
      null,
      false
    );

  }
};
const deleteRating = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Users
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "user"
    ) {

      return createResponse(
        res,
        403,
        "Only users can delete ratings",
        null,
        false
      );

    }

    const { ratingId } = req.body;

    if (!ratingId) {

      return createResponse(
        res,
        400,
        "ratingId is required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Rating
    // ─────────────────────────────────────────────

    const rating = await Rating.findById(
      ratingId
    );

    if (!rating) {

      return createResponse(
        res,
        404,
        "Rating not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Ownership Check
    // ─────────────────────────────────────────────

    if (
      rating.user.toString() !==
      authUser.id
    ) {

      return createResponse(
        res,
        403,
        "You can delete only your ratings",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Shop
    // ─────────────────────────────────────────────

    const shop = await Shop.findById(
      rating.shop
    );

    if (!shop) {

      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );

    }

    const deletedRatingValue =
      rating.ratingNumber;

    const oldAvg =
      shop.rating || 0;

    const oldCount =
      shop.ratingCount || 0;

    // ─────────────────────────────────────────────
    // Delete Rating
    // ─────────────────────────────────────────────

    await Rating.findByIdAndDelete(
      ratingId
    );

    // ─────────────────────────────────────────────
    // Update Average
    // ─────────────────────────────────────────────

    if (oldCount === 1) {

      shop.rating = 0;
      shop.ratingCount = 0;

    } else {

      const newAvg =
        (
          (oldAvg * oldCount) -
          deletedRatingValue
        ) /
        (oldCount - 1);

      shop.rating = Number(
        newAvg.toFixed(2)
      );

      shop.ratingCount =
        oldCount - 1;

    }

    await shop.save();

    return createResponse(
      res,
      200,
      "Rating deleted successfully",
      null,
      true
    );

  } catch (err) {

    console.error(err);

    return createResponse(
      res,
      500,
      err.message,
      null,
      false
    );

  }
};

module.exports = {
  giveRating,
  deleteRating
};