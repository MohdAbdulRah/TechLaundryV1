const User = require("../../Models/User/User")
const Shop = require("../../Models/Shop/Shop")
const {createResponse} = require("../../utils/Response")
const { Delivery } = require("../../Models/Delivery/Delivery");
const { Otp } = require("../../Models/OtpCode/OtpCode");
const addShop = async (req,res) => {
    try{
    const {name,address,location} = req.body

    const userId = req.user.id

    const shop = new Shop({
        name,
        address,
        location
    })

    await shop.save()

    const user = await User.findById(userId)
    user.shop = shop

    await user.save()


    return createResponse(res,201,"Successfully Created Shop",shop,true)
     }
     catch(err){
       return createResponse(res,200,err.message,null,false)
     }
}
const updateShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    const { name, address, location } = req.body;

    const userId = req.user.id;

    // Find user
    const user = await User.findById(userId);

    // Check if user owns the shop
    if (!user.shop || user.shop.toString() !== shopId) {
      return createResponse(
        res,
        403,
        "You are not authorized to edit this shop",
        null,
        false
      );
    }

    // Find and update shop
    const updatedShop = await Shop.findByIdAndUpdate(
      shopId,
      {
        name,
        address,
        location,
      },
      { new: true }
    );

    if (!updatedShop) {
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
      "Shop updated successfully",
      updatedShop,
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


// ================= DELETE SHOP =================
const deleteShop = async (req, res) => {
  try {
    const { shopId } = req.params;

    const userId = req.user.id;

    // Find user
    const user = await User.findById(userId);

    // Check ownership
    if (!user.shop || user.shop.toString() !== shopId) {
      return createResponse(
        res,
        403,
        "You are not authorized to delete this shop",
        null,
        false
      );
    }

    // Delete shop
    const deletedShop = await Shop.findByIdAndDelete(shopId);

    if (!deletedShop) {
      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );
    }

    // Remove shop reference from user
    user.shop = null;

    await user.save();

    return createResponse(
      res,
      200,
      "Shop deleted successfully",
      deletedShop,
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
const getMyShopOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // ================= FIND SHOP OWNER =================
    const user = await User.findById(userId);

    if (!user) {
      return createResponse(
        res,
        404,
        "User not found",
        null,
        false
      );
    }

    if (user.role !== "shopOwner") {
      return createResponse(
        res,
        403,
        "Only shop owners can access this",
        null,
        false
      );
    }

    if (!user.shop) {
      return createResponse(
        res,
        404,
        "No shop linked to this account",
        null,
        false
      );
    }

    const shopId = user.shop;

    // ================= FIND DELIVERIES =================
    const deliveries = await Delivery.find({
      "services.shop": shopId,
    })
      .populate("user", "firstName lastName phone address")
      .populate("deliveryBoys.deliveryBoy")
      .populate("services.price")
      .populate("services.shop")
      .sort({ createdAt: -1 });

    // ================= FORMAT RESPONSE =================
    const formattedDeliveries = deliveries.map((delivery) => {

      // only services belonging to this shop
      const myServices = delivery.services.filter(
        (service) =>
          service.shop &&
          service.shop._id.toString() === shopId.toString()
      );

      // ================= DELIVERY BOYS FILTER =================
      let visibleDeliveryBoys = delivery.deliveryBoys;

      // if collected_from_user → only order 0 delivery boys
      if (delivery.status === "collected_from_user") {
        visibleDeliveryBoys = delivery.deliveryBoys.filter(
          (d) => d.order === 0
        );
      }

      return {
        deliveryId: delivery._id,

        customer: delivery.user,

        deliveryStatus: delivery.status,

        deliveryBoys: visibleDeliveryBoys.map((d) => ({
          deliveryBoy: d.deliveryBoy,
          order: d.order,
          status: d.status,
        })),

        services: myServices.map((service) => ({
          serviceId: service._id,
          quantity: service.quantity,
          status: service.status,
          price: service.price,
          shop: service.shop,
        })),

        createdAt: delivery.createdAt,
      };
    });

    return createResponse(
      res,
      200,
      "Shop orders fetched successfully",
      formattedDeliveries,
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
const getOtpForShopOwner = async (req, res) => {

  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Shop Owner
    // ─────────────────────────────────────────────

    if (!authUser || authUser.role !== "shopOwner") {

      return createResponse(
        res,
        403,
        "Only shop owners can access OTP",
        null,
        false
      );

    }

    const { deliveryId } = req.body;

    if (!deliveryId) {

      return createResponse(
        res,
        400,
        "deliveryId is required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Shop Owner User
    // ─────────────────────────────────────────────

    const shopOwner = await User.findById(authUser.id);

    if (!shopOwner || !shopOwner.shop) {

      return createResponse(
        res,
        404,
        "Shop owner shop not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Delivery
    // ─────────────────────────────────────────────

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {

      return createResponse(
        res,
        404,
        "Delivery not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Validate delivery contains services
    // for this shop
    // ─────────────────────────────────────────────

    const hasShopServices = delivery.services.some(
      (service) =>
        service.shop &&
        service.shop.toString() ===
          shopOwner.shop.toString()
    );

    if (!hasShopServices) {

      return createResponse(
        res,
        404,
        "No services found for your shop",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Active OTP (within 5 mins)
    // ─────────────────────────────────────────────

    const otpDoc = await Otp.findOne({

      user1: shopOwner._id,
      delivery: deliveryId,

      createdAt: {
        $gte: new Date(Date.now() - 5 * 60 * 1000)
      }

    })
      .sort({ createdAt: -1 });

    if (!otpDoc) {

      return createResponse(
        res,
        404,
        "No active OTP found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────

    return createResponse(
      res,
      200,
      "OTP fetched successfully",
      {
        otp: otpDoc.otp,
        deliveryId,
        status: otpDoc.status,
        createdAt: otpDoc.createdAt
      },
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
const markServiceDone = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Shop Owner
    // ─────────────────────────────────────────────

    if (!authUser || authUser.role !== "shopOwner") {

      return createResponse(
        res,
        403,
        "Only shop owners can update service status",
        null,
        false
      );

    }

    const { deliveryId, serviceId } = req.body;

    if (!deliveryId || !serviceId) {

      return createResponse(
        res,
        400,
        "deliveryId and serviceId are required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Shop Owner
    // ─────────────────────────────────────────────

    const shopOwner = await User.findById(authUser.id);

    if (!shopOwner || !shopOwner.shop) {

      return createResponse(
        res,
        404,
        "Shop not found for this user",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Delivery
    // ─────────────────────────────────────────────

    const delivery = await Delivery.findById(deliveryId);

    if (!delivery) {

      return createResponse(
        res,
        404,
        "Delivery not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Service
    // ─────────────────────────────────────────────

    const service = delivery.services.id(serviceId);

    if (!service) {

      return createResponse(
        res,
        404,
        "Service not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Check Shop Ownership
    // ─────────────────────────────────────────────

    if (
      !service.shop ||
      service.shop.toString() !== shopOwner.shop.toString()
    ) {

      return createResponse(
        res,
        403,
        "You are not authorized to update this service",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Service must be given_to_shop
    // ─────────────────────────────────────────────

    if (service.status !== "given_to_shop") {

      return createResponse(
        res,
        400,
        "Service status must be given_to_shop",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Update Service Status
    // ─────────────────────────────────────────────

    service.status = "service_done";

    // ─────────────────────────────────────────────
    // Check if ALL services are service_done
    // ─────────────────────────────────────────────

    const allServicesDone = delivery.services.every(
      (s) =>
        s._id.toString() === serviceId
          ? true
          : s.status === "service_done"
    );

    // ─────────────────────────────────────────────
    // Update Delivery Status
    // ─────────────────────────────────────────────

    if (allServicesDone) {

      delivery.status = "service_done";

    }

    await delivery.save();

    return createResponse(
      res,
      200,
      "Service marked as service_done successfully",
      delivery,
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
const addDeliveryBoyForShopToCollect = async (
  req,
  res
) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Shop Owner
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "shopOwner"
    ) {

      return createResponse(
        res,
        403,
        "Only shop owners can add delivery boy",
        null,
        false
      );

    }

    const { deliveryId } = req.body;

    if (!deliveryId) {

      return createResponse(
        res,
        400,
        "deliveryId is required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Shop Owner
    // ─────────────────────────────────────────────

    const shopOwner = await User.findById(
      authUser.id
    );

    if (
      !shopOwner ||
      !shopOwner.shop
    ) {

      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Delivery
    // ─────────────────────────────────────────────

    const delivery =
      await Delivery.findById(deliveryId);

    if (!delivery) {

      return createResponse(
        res,
        404,
        "Delivery not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Get all services belonging to this shop
    // ─────────────────────────────────────────────

    const shopServices =
      delivery.services.filter(
        (service) =>
          service.shop &&
          service.shop.toString() ===
            shopOwner.shop.toString()
      );

    if (shopServices.length === 0) {

      return createResponse(
        res,
        403,
        "No services found for your shop",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // ALL services of this shop must be done
    // ─────────────────────────────────────────────

    const allShopServicesDone =
      shopServices.every(
        (service) =>
          service.status ===
          "service_done"
      );

    if (!allShopServicesDone) {

      return createResponse(
        res,
        400,
        "All services must be service_done before assigning delivery boy",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Check existing order:1 pending
    // ─────────────────────────────────────────────

    const existingDeliveryBoy =
      delivery.deliveryBoys.find(
        (d) =>
          d.order === 1 &&
          d.status === "Pending"
      );

    if (existingDeliveryBoy) {

      return createResponse(
        res,
        200,
        "Existing pending delivery boy already assigned",
        existingDeliveryBoy,
        true
      );

    }

    // ─────────────────────────────────────────────
    // Find nearest available delivery boy
    // ─────────────────────────────────────────────

    const nearestDeliveryBoy =
      await User.findOne({
        role: "deliveryBoy",
        inDelivery: false,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates:
                delivery.userLocation
                  .coordinates,
            },
          },
        },
      });

    if (!nearestDeliveryBoy) {

      return createResponse(
        res,
        404,
        "No available delivery boy found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Add Delivery Boy
    // ─────────────────────────────────────────────
const newDeliveryBoy = {
  deliveryBoy: nearestDeliveryBoy._id,
  order: 1,
  status: "Pending",
};

delivery.deliveryBoys.push(
  newDeliveryBoy
);

nearestDeliveryBoy.inDelivery = true;

await nearestDeliveryBoy.save();

await delivery.save();

// ─────────────────────────────────────────────
// Populate newly added delivery boy
// ─────────────────────────────────────────────

await delivery.populate(
  "deliveryBoys.deliveryBoy",
  "firstName lastName phone"
);

const populatedDeliveryBoy =
  delivery.deliveryBoys.find(
    (d) =>
      d.order === 1 &&
      d.deliveryBoy &&
      d.deliveryBoy._id.toString() ===
        nearestDeliveryBoy._id.toString()
  );

return createResponse(
  res,
  200,
  "Delivery boy assigned successfully",
  populatedDeliveryBoy,
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
const getValidOtpForCollectionFromShop = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Shop Owner
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "shopOwner"
    ) {

      return createResponse(
        res,
        403,
        "Only shop owners can access OTP",
        null,
        false
      );

    }
    const shopOwner = await User.findById(
  authUser.id
);

if (!shopOwner || !shopOwner.shop) {

  return createResponse(
    res,
    404,
    "Shop not found for this shop owner",
    null,
    false
  );

}
    const { deliveryId } = req.params;

    // ─────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────

    if (!deliveryId) {

      return createResponse(
        res,
        400,
        "deliveryId is required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Delivery
    // ─────────────────────────────────────────────

    const delivery = await Delivery.findById(
      deliveryId
    ).populate("services.shop");

    if (!delivery) {

      return createResponse(
        res,
        404,
        "Delivery not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Get Services Belonging To Shop Owner
    // ─────────────────────────────────────────────

  const servicesForShop =
  delivery.services.filter((service) => {

    if (!service.shop) return false;

    const currentShopId =
      service.shop._id
        ? service.shop._id.toString()
        : service.shop.toString();

    return (
      currentShopId ===
      shopOwner.shop.toString()
    );

  });

    if (servicesForShop.length === 0) {

      return createResponse(
        res,
        404,
        "No services found for your shop in this delivery",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Check ALL Services Are service_done
    // ─────────────────────────────────────────────

    const allServicesDone =
      servicesForShop.every(
        (service) =>
          service.status === "service_done"
      );

    if (!allServicesDone) {

      return createResponse(
        res,
        400,
        "All services must be completed before fetching OTP",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Valid OTP
    // status = 1 => collection from shop
    // Expiration = 5 mins
    // ─────────────────────────────────────────────

    const otp = await Otp.findOne({
      delivery: deliveryId,
      user1: authUser.id,
      status: 1,
      createdAt: {
        $gte: new Date(
          Date.now() - 5 * 60 * 1000
        )
      }
    }).sort({ createdAt: -1 });

    if (!otp) {

      return createResponse(
        res,
        404,
        "No valid OTP found or OTP expired",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────

    return createResponse(
      res,
      200,
      "OTP fetched successfully",
      {
        otpId: otp._id,
        otp: otp.otp,
        deliveryId: otp.delivery,
        createdAt: otp.createdAt,
        expiresIn: "5 minutes"
      },
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
const getShopDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find logged-in user
    const owner = await User.findById(userId);

    if (!owner || !owner.shop) {
      return createResponse(
        res,
        404,
        "No shop associated with this user",
        null,
        false
      );
    }

    // Find shop
    const shop = await Shop.findById(owner.shop).populate("prices");

    if (!shop) {
      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );
    }

    const shopDetails = {
      shopId: shop._id,
      name: shop.name,
      address: shop.address,
      location: shop.location,
      prices: shop.prices,
      rating: shop.rating,
      ratingCount: shop.ratingCount,
      totalOrders: shop.totalOrders,
      avgDeliveryTime: shop.avgDeliveryTime,
      owner: {
        ownerId: owner._id,
        name: `${owner.firstName}${
          owner.lastName ? " " + owner.lastName : ""
        }`,
        username: owner.username,
        email: owner.email,
        phone: owner.phone ?? null,
        address: owner.address ?? null,
        location: owner.location ?? null,
      },
    };

    return createResponse(
      res,
      200,
      "Shop details fetched successfully",
      shopDetails,
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
const getShopOwnerProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Owner
    const owner = await User.findById(userId);

    if (!owner || !owner.shop) {
      return createResponse(
        res,
        404,
        "Shop owner or shop not found",
        null,
        false
      );
    }

    // Shop
    const shop = await Shop.findById(owner.shop)
      .populate("prices");

    if (!shop) {
      return createResponse(
        res,
        404,
        "Shop not found",
        null,
        false
      );
    }

    // Deliveries containing this shop
    const deliveries = await Delivery.find({
      "services.shop": shop._id
    })
      .populate("user", "firstName lastName username");

    // ----------------------------
    // Analytics
    // ----------------------------

    let totalRevenue = 0;

    const customerMap = {};

    deliveries.forEach((delivery) => {
      if (delivery.user) {
        const customerId = delivery.user._id.toString();

        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            customerId,
            customerName:
              `${delivery.user.firstName || ""} ${delivery.user.lastName || ""}`.trim() ||
              delivery.user.username,
            ordersPlaced: 0
          };
        }

        customerMap[customerId].ordersPlaced += 1;
      }

      delivery.services.forEach((service) => {
        if (service.shop.toString() !== shop._id.toString()) {
          return;
        }

        const matchedPrice = shop.prices.find(
          (price) => price._id.toString() === service.price.toString()
        );

        if (matchedPrice) {
          totalRevenue +=
            matchedPrice.charge * service.quantity;
        }
      });
    });

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.ordersPlaced - a.ordersPlaced)
      .slice(0, 3);

    const profile = {
      user: {
        _id: owner._id,
        username: owner.username,
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        phone: owner.phone,
        role: owner.role,
        address: owner.address,
        location: owner.location
      },

      shop: {
        _id: shop._id,
        shopName: shop.name,
        rating: shop.rating,
        totalReviews: shop.ratingCount,
        address: shop.address,
        location: shop.location,
        totalOrders: shop.totalOrders || 0,
        avgDeliveryTime: shop.avgDeliveryTime || 0
      },

      analytics: {
        totalOrders: deliveries.length,
        totalRevenue,
        totalServicesOffered: shop.prices.length,
        totalCustomers: Object.keys(customerMap).length,
        topCustomers
      }
    };

    return createResponse(
      res,
      200,
      "Shop profile fetched successfully",
      profile,
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
module.exports = {
  addShop,
  updateShop,
  deleteShop,
  getMyShopOrders,
  getOtpForShopOwner,
  markServiceDone,
  addDeliveryBoyForShopToCollect,
  getValidOtpForCollectionFromShop,
  getShopDetails,
  getShopOwnerProfile
}