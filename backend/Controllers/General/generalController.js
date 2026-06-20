const { default: mongoose } = require("mongoose");
const Shop = require("../../Models/Shop/Shop")
const Rating = require("../../Models/Shop/Rating")
const {Delivery} = require("../../Models/Delivery/Delivery")
const User = require("../../Models/User/User")
const {PriceCategory} = require("../../Models/Admin/PriceCategory")
const {createResponse} = require("../../utils/Response")

const allShops = async (req, res) => {
    try {
        const user = req.user;

        if (user.role !== "user") {
            return createResponse(
                res,
                403,
                "You cannot access this resource",
                null,
                false
            );
        }

        const currUser = await User.findById(user.id);

        let shops;

        // If user location is not available
        if (
            !currUser.location ||
            !currUser.location.coordinates ||
            currUser.location.coordinates.length !== 2
        ) {

            shops = await Shop.find({})
                .populate({
  path: "prices",
  populate: {
    path: "category"
  }
});

        } 
        // If location exists
        else {

            shops = await Shop.aggregate([
    {
        $geoNear: {
            near: {
                type: "Point",
                coordinates: currUser.location.coordinates
            },
            distanceField: "distance",
            spherical: true
        }
    },

    // Populate prices
    {
        $lookup: {
            from: "prices",
            localField: "prices",
            foreignField: "_id",
            as: "prices"
        }
    },

    // Remove shops with no prices
    {
        $match: {
            "prices.0": { $exists: true }
        }
    },

    // Unwind prices
    {
        $unwind: "$prices"
    },

    // Populate category
    {
        $lookup: {
            from: "pricecategories",
            localField: "prices.category",
            foreignField: "_id",
            as: "categoryData"
        }
    },

    // Convert category array to object
    {
        $addFields: {
            "prices.category": {
                $arrayElemAt: ["$categoryData", 0]
            }
        }
    },

    // Remove temporary field
    {
        $project: {
            categoryData: 0
        }
    },

    // Rebuild shop
    {
        $group: {
            _id: "$_id",
            name: { $first: "$name" },
            address: { $first: "$address" },
            location: { $first: "$location" },
            distance: { $first: "$distance" },
            prices: { $push: "$prices" }
        }
    }
]);

        }

        return createResponse(
            res,
            200,
            "All Shops Fetched",
            shops,
            true
        );

    } catch (err) {

        return createResponse(
            res,
           500,
            err.message,
            null,
            false
        );
    }
};

const viewShop = async (req,res) => {
    try{
     const shopId = new mongoose.Types.ObjectId(req.params.shopId);
     const shop = await Shop.findById(shopId);

     const currentUserRating = await Rating.findOne({
        shop: shopId,
        user: req.user.id
      });

        return createResponse(
        res,
        200,
        "Shop fetched successfully",
        {
            ...shop.toObject(),
            currentUserRating
        },
        true
        );
    }
    catch(err){
       return createResponse(res,404,err.message,null,false); 
    }
     
}

const getServiceOfShop = async (req,res) => {
     try{
     const shopId = new mongoose.Types.ObjectId(req.params.shopId);
     const shop = await Shop.findById(shopId)
.populate({
  path: "prices",
  populate: {
    path: "category"
  }
});
     return createResponse(res,200,`Fetched the Shop ${shop.name}`,shop,true);
    }
    catch(err){
       return createResponse(res,404,err.message,null,false); 
    }
}

// ================= GET ALL CATEGORIES =================
const getAllCategories = async (req, res) => {
  try {

        const categories = await PriceCategory.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
const getMyAnalytics = async (req, res) => {
  try {
    const authUser = req.user;

    const user = await User.findById(authUser.id)
      .populate("shop")
      .select("-password");

    if (!user) {
      return createResponse(
        res,
        404,
        "User not found",
        null,
        false
      );
    }

    const deliveries = await Delivery.find({
      user: authUser.id
    })
      .populate("services.shop", "name");

    const totalOrders = deliveries.length;

    const shopMap = new Map();

    let totalServicesSelected = 0;

    deliveries.forEach((delivery) => {
      delivery.services.forEach((service) => {

        totalServicesSelected++;

        const shopId = service.shop?._id?.toString();

        if (!shopId) return;

        if (!shopMap.has(shopId)) {
          shopMap.set(shopId, {
            shopId,
            shopName: service.shop.name,
            servicesSelected: 0
          });
        }

        shopMap.get(shopId).servicesSelected += 1;
      });
    });

    const shopsInteracted = Array.from(shopMap.values());

    const responseData = {
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        location: user.location
      },

      analytics: {
        totalOrders,
        totalShopsInteracted: shopsInteracted.length,
        totalServicesSelected,
        shopsInteracted
      }
    };

    return createResponse(
      res,
      200,
      "Profile analytics fetched successfully",
      responseData,
      true
    );

  } catch (error) {

    return createResponse(
      res,
      500,
      error.message,
      null,
      false
    );

  }
};

module.exports = {allShops,viewShop,getServiceOfShop,getAllCategories,getMyAnalytics}