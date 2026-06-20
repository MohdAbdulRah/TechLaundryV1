const Shop = require("../../Models/Shop/Shop");
const User = require("../../Models/User/User");
const { Delivery } = require("../../Models/Delivery/Delivery");

const getAllShopsAnalytics = async (req, res) => {
  try {

    const shops = await Shop.find()
      .populate("prices");

    const result = await Promise.all(

      shops.map(async (shop) => {

        // ─────────────────────────────
        // Shop Owner
        // ─────────────────────────────

        const owner = await User.findOne({
          shop: shop._id,
          role: "shopOwner"
        }).select(
          "-password"
        );

        // ─────────────────────────────
        // Deliveries containing shop
        // ─────────────────────────────

        const deliveries = await Delivery.find({
          "services.shop": shop._id
        });

        const totalDeliveries =
          deliveries.length;

        let completedDeliveries = 0;

        let pendingDeliveries = 0;

        deliveries.forEach((delivery) => {

          const shopServices =
            delivery.services.filter(
              (service) =>
                service.shop.toString() ===
                shop._id.toString()
            );

          const completed =
            shopServices.every(
              (service) =>
                service.status ===
                "given_to_user"
            );

          if (completed) {
            completedDeliveries++;
          } else {
            pendingDeliveries++;
          }

        });

        return {

          shop: {
            _id: shop._id,
            name: shop.name,
            address: shop.address,
            rating: shop.rating,
            ratingCount: shop.ratingCount,
            totalOrders: totalDeliveries,
            avgDeliveryTime:
              shop.avgDeliveryTime,
            location: shop.location,
            servicesCount:
              shop.prices.length
          },

          owner: owner
            ? {
                _id: owner._id,
                username:
                  owner.username,
                firstName:
                  owner.firstName,
                lastName:
                  owner.lastName,
                email:
                  owner.email,
                phone:
                  owner.phone
              }
            : null,

          analytics: {
            totalDeliveries,
            completedDeliveries,
            pendingDeliveries
          }

        };

      })

    );

    return res.status(200).json({
      success: true,
      message:
        "Shops analytics fetched successfully",
      data: result
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

module.exports = {
  getAllShopsAnalytics
};