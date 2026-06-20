const User = require("../../Models/User/User");
const Shop = require("../../Models/Shop/Shop");
const Price = require("../../Models/Shop/Price");
const { Delivery } = require("../../Models/Delivery/Delivery");

const getAllUsersAnalytics = async (req, res) => {
  try {

    // Get all normal users
    const users = await User.find({
      role: "user"
    }).select("-password");

    const result = await Promise.all(

      users.map(async (user) => {

        // All orders of this user
        const deliveries = await Delivery.find({
          user: user._id
        });

        const analytics = {
          totalOrders: deliveries.length,

          started: 0,
          collected_from_user: 0,
          given_to_shops: 0,
          service_done: 0,
          collected_from_shops: 0,
          given_to_user: 0
        };

        deliveries.forEach((delivery) => {

          switch (delivery.status) {

            case "started":
              analytics.started++;
              break;

            case "collected_from_user":
              analytics.collected_from_user++;
              break;

            case "given_to_shops":
              analytics.given_to_shops++;
              break;

            case "service_done":
              analytics.service_done++;
              break;

            case "collected_from_shops":
              analytics.collected_from_shops++;
              break;

            case "given_to_user":
              analytics.given_to_user++;
              break;

            default:
              break;
          }

        });

        const completedOrders =
          analytics.given_to_user;

        const activeOrders =
          analytics.totalOrders -
          completedOrders;

        const completionRate =
          analytics.totalOrders === 0
            ? 0
            : Number(
                (
                  (completedOrders /
                    analytics.totalOrders) *
                  100
                ).toFixed(2)
              );

        return {

          user: {
            _id: user._id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            address: user.address,
            location: user.location
          },

          analytics: {

            totalOrders:
              analytics.totalOrders,

            activeOrders,

            completedOrders,

            completionRate,

            statusBreakdown: {

              started:
                analytics.started,

              collected_from_user:
                analytics.collected_from_user,

              given_to_shops:
                analytics.given_to_shops,

              service_done:
                analytics.service_done,

              collected_from_shops:
                analytics.collected_from_shops,

              given_to_user:
                analytics.given_to_user
            }

          }

        };

      })

    );

    // Sort by highest orders
    result.sort(
      (a, b) =>
        b.analytics.totalOrders -
        a.analytics.totalOrders
    );

    return res.status(200).json({
      success: true,
      message:
        "Users analytics fetched successfully",
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

const getAdminDashboardOverview = async (req, res) => {
  try {

    const [
      totalUsers,
      totalShopOwners,
      totalDeliveryBoys,
      totalShops,
      totalServices,
      totalDeliveries
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "shopOwner" }),
      User.countDocuments({ role: "deliveryBoy" }),
      Shop.countDocuments(),
      Price.countDocuments(),
      Delivery.countDocuments()
    ]);

    const statusBreakdown = {
      started: await Delivery.countDocuments({
        status: "started"
      }),

      collected_from_user: await Delivery.countDocuments({
        status: "collected_from_user"
      }),

      given_to_shops: await Delivery.countDocuments({
        status: "given_to_shops"
      }),

      service_done: await Delivery.countDocuments({
        status: "service_done"
      }),

      collected_from_shops: await Delivery.countDocuments({
        status: "collected_from_shops"
      }),

      given_to_user: await Delivery.countDocuments({
        status: "given_to_user"
      })
    };

    const activeDeliveries =
      totalDeliveries - statusBreakdown.given_to_user;

    const completedDeliveries =
      statusBreakdown.given_to_user;

    const topShops = await Shop.find()
      .sort({ totalOrders: -1 })
      .limit(5)
      .select(
        "name rating ratingCount totalOrders avgDeliveryTime"
      );

    const topServices = await Price.find()
      .sort({ timesOrdered: -1 })
      .limit(5)
      .populate("category", "name")
      .select(
        "name charge timesOrdered avgReview expressAvailable"
      );

    const topDeliveryBoys = await User.find({
      role: "deliveryBoy"
    })
      .sort({ inDelivery: -1 })
      .limit(5)
      .select(
        "username firstName lastName email phone inDelivery"
      );

    const recentDeliveries = await Delivery.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate(
        "user",
        "username firstName lastName"
      )
      .select(
        "status createdAt updatedAt"
      );

    return res.status(200).json({
      success: true,
      message:
        "Admin dashboard overview fetched successfully",

      data: {

        summary: {
          totalUsers,
          totalShopOwners,
          totalDeliveryBoys,
          totalShops,
          totalServices,
          totalDeliveries,
          activeDeliveries,
          completedDeliveries
        },

        deliveryStatusBreakdown: statusBreakdown,

        topShops,

        topServices,

        topDeliveryBoys,

        recentDeliveries
      }
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
  getAllUsersAnalytics,
  getAdminDashboardOverview
};