const Price = require("../../Models/Shop/Price");
const Shop = require("../../Models/Shop/Shop");
const User = require("../../Models/User/User");
const mongoose = require("mongoose");
const { createResponse } = require("../../utils/Response");
const { Delivery } = require("../../Models/Delivery/Delivery");
// ================= VIEW SINGLE PRICE =================
const viewPrice = async (req, res) => {
  try {
    const { shopId, priceId } = req.params;

    // Find shop
    const shop = await Shop.findById(new mongoose.Types.ObjectId(shopId));

    if (!shop) {
      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );
    }

    // Check if price belongs to shop
    const exists = shop.prices.includes(new mongoose.Types.ObjectId(priceId));

    if (!exists) {
      return createResponse(
        res,
        404,
        "Price does not belong to this shop",
        null,
        false
      );
    }

    // Find price
    const price = await Price.findById(new mongoose.Types.ObjectId(priceId)).populate("category");

    if (!price) {
      return createResponse(
        res,
        404,
        "Price not found",
        null,
        false
      );
    }

    return createResponse(
      res,
      200,
      "Price fetched successfully",
      price,
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};


// ================= VIEW ALL PRICES =================
const viewAllPrices = async (req, res) => {
  try {
    const { shopId } = req.params;

    const shop = await Shop.findById(new mongoose.Types.ObjectId(shopId))
      .populate({
  path: "prices",
  populate: {
    path: "category"
  }
});

    if (!shop) {
      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );
    }

    return createResponse(
      res,
      200,
      "Prices fetched successfully",
      shop.prices,
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};
// ================= ADD PRICE =================
const addPrice = async (req, res) => {
  try {
    const { name, charge, picture, icon,category } = req.body;

    const { shopId } = req.params;

    const userId = req.user.id;

    // Find current user
    const user = await User.findById(userId);

    // Check ownership
    if (!user.shop || user.shop.toString() !== shopId) {
      return createResponse(
        res,
        403,
        "You are not authorized to add price to this shop",
        null,
        false
      );
    }

    const price = new Price({
      name,
      charge,
      picture,
      icon,
      category
    });

    await price.save();

    const shop = await Shop.findById(shopId);

    shop.prices.push(price._id);

    await shop.save();

    return createResponse(
      res,
      201,
      "Successfully Created Price",
      price,
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};


// ================= UPDATE PRICE =================
const updatePrice = async (req, res) => {
  try {
    const { shopId, priceId } = req.params;

    const { name, charge, picture, icon,category } = req.body;

    const userId = req.user.id;

    // Find current user
    const user = await User.findById(userId);

    // Check shop ownership
    if (!user.shop || user.shop.toString() !== shopId) {
      return createResponse(
        res,
        403,
        "You are not authorized to update this price",
        null,
        false
      );
    }

    // Check if price belongs to this shop
    const shop = await Shop.findById(shopId);

    const exists = shop.prices.includes(priceId);

    if (!exists) {
      return createResponse(
        res,
        404,
        "Price does not belong to this shop",
        null,
        false
      );
    }

    const updatedPrice = await Price.findByIdAndUpdate(
  priceId,
  {
    name,
    charge,
    picture,
    icon,
    category
  },
  { new: true }
).populate("category");

    if (!updatedPrice) {
      return createResponse(
        res,
        404,
        "Price not found",
        null,
        false
      );
    }

    return createResponse(
      res,
      200,
      "Price updated successfully",
      updatedPrice,
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};


// ================= DELETE PRICE =================
const deletePrice = async (req, res) => {
  try {
    const { shopId, priceId } = req.params;

    const userId = req.user.id;

    // Find current user
    const user = await User.findById(userId);

    // Check ownership
    if (!user.shop || user.shop.toString() !== shopId) {
      return createResponse(
        res,
        403,
        "You are not authorized to delete this price",
        null,
        false
      );
    }

    // Find shop
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

    // Check if price belongs to this shop
    const exists = shop.prices.includes(priceId);

    if (!exists) {
      return createResponse(
        res,
        404,
        "Price does not belong to this shop",
        null,
        false
      );
    }

    // Delete price
    const deletedPrice = await Price.findByIdAndDelete(priceId);

    if (!deletedPrice) {
      return createResponse(
        res,
        404,
        "Price not found",
        null,
        false
      );
    }

    // Remove price from shop
    shop.prices = shop.prices.filter(
      (price) => price.toString() !== priceId
    );

    await shop.save();

    return createResponse(
      res,
      200,
      "Price deleted successfully",
      deletedPrice,
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};

const getShopId = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user || !user.shop) {
      return createResponse(
        res,
        403,
        "You are not authorized to access shop",
        null,
        false
      );
    }

    return createResponse(
      res,
      200,
      "Shop fetched successfully",
      {
        shopId: user.shop,
      },
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};
const getShopOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user || !user.shop) {
      return createResponse(
        res,
        403,
        "You are not authorized to access shop",
        null,
        false
      );
    }

    const shopId = user.shop;

    // Shop details
    const shop = await Shop.findById(shopId)
      .populate({
        path: "prices",
        populate: {
          path: "category"
        }
      });

    if (!shop) {
      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );
    }

    // Total prices/services
    const totalPrices = shop.prices.length;

    // Unique categories count
    const totalCategories = new Set(
      shop.prices
        .filter(price => price.category)
        .map(price => price.category._id.toString())
    ).size;

    // Deliveries containing this shop
    const deliveries = await Delivery.find({
      "services.shop": shopId
    });

    const deliveryStats = {
      total: deliveries.length,
      started: 0,
      collected_from_user: 0,
      given_to_shops: 0,
      service_done: 0,
      marked_for_delivery: 0,
      collected_from_shops: 0,
      given_to_user: 0
    };

    let totalServicesProcessed = 0;

    deliveries.forEach(delivery => {
      if (deliveryStats.hasOwnProperty(delivery.status)) {
        deliveryStats[delivery.status]++;
      }

      totalServicesProcessed += delivery.services.filter(
        service => service.shop.toString() === shopId.toString()
      ).length;
    });

    const overview = {
      shop: {
        id: shop._id,
        name: shop.name,
        address: shop.address,
        rating: shop.rating,
        ratingCount: shop.ratingCount,
        totalOrders: shop.totalOrders || 0,
        avgDeliveryTime: shop.avgDeliveryTime || 0,
        location: shop.location
      },

      statistics: {
        totalPrices,
        totalCategories,
        totalServicesProcessed
      },

      deliveries: deliveryStats
    };

    return createResponse(
      res,
      200,
      "Shop overview fetched successfully",
      overview,
      true
    );

  } catch (err) {
    return createResponse(
      res,
      400,
      err.message,
      null,
      false
    );
  }
};
module.exports = {
  viewPrice,
  viewAllPrices,
  addPrice,
  updatePrice,
  deletePrice,
  getShopId,
  getShopOverview
};