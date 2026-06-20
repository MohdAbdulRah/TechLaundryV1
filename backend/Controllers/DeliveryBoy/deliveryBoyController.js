const User = require("../../Models/User/User");
const { Delivery } = require("../../Models/Delivery/Delivery");

const getDeliveryBoyProfile = async (req, res) => {
  try {

    const authUser = req.user;

    if (!authUser || authUser.role !== "deliveryBoy") {
      return res.status(403).json({
        success: false,
        message: "Only delivery boys can access profile"
      });
    }

    // ─────────────────────────────
    // Delivery Boy Details
    // ─────────────────────────────

    const deliveryBoy = await User.findById(authUser.id).select(
      "-password"
    );

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found"
      });
    }

    // ─────────────────────────────
    // All Deliveries
    // ─────────────────────────────

    const deliveries = await Delivery.find({
      "deliveryBoys.deliveryBoy": authUser.id
    })
      .populate("user", "firstName lastName phone")
      .sort({ createdAt: -1 });

    const totalDeliveries = deliveries.length;

    let completedDeliveries = 0;
    let pendingDeliveries = 0;

    let userToShopTrips = 0;
    let shopToUserTrips = 0;

    let activeDelivery = null;
    let lastCompletedDelivery = null;

    deliveries.forEach((delivery) => {

      const currentAssignment =
        delivery.deliveryBoys.find(
          (d) =>
            d.deliveryBoy.toString() ===
            authUser.id.toString()
        );

      if (!currentAssignment) return;

      if (currentAssignment.status === "Done") {

        completedDeliveries++;

        if (!lastCompletedDelivery) {
          lastCompletedDelivery = delivery.createdAt;
        }

        if (currentAssignment.order === 0) {
          userToShopTrips++;
        }

        if (currentAssignment.order === 1) {
          shopToUserTrips++;
        }

      } else {

        pendingDeliveries++;

        if (!activeDelivery) {
          activeDelivery = delivery._id;
        }
      }
    });

    const completionRate =
      totalDeliveries === 0
        ? 0
        : Number(
            (
              (completedDeliveries /
                totalDeliveries) *
              100
            ).toFixed(2)
          );

    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully",
      data: {
        profile: {
          _id: deliveryBoy._id,
          username: deliveryBoy.username,
          firstName: deliveryBoy.firstName,
          lastName: deliveryBoy.lastName,
          email: deliveryBoy.email,
          phone: deliveryBoy.phone,
          address: deliveryBoy.address,
          location: deliveryBoy.location,
          inDelivery: deliveryBoy.inDelivery,
          avail : deliveryBoy.avail
        },

        analytics: {
          totalDeliveries,
          completedDeliveries,
          pendingDeliveries,
          userToShopTrips,
          shopToUserTrips,
          completionRate,
          lastCompletedDelivery,
          activeDelivery
        }
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

const updateAvail = async (req,res) => {
  try{
    const {avail} = req.body;

    const authUser = req.user;
    if (!authUser || authUser.role !== "deliveryBoy") {
      return res.status(403).json({
        success: false,
        message: "Only delivery boys can Change Avalaibility"
      });
    }

    const deliveryBoy = await User.findById(authUser.id)

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found"
      });
    }
    // Don't allow availability changes while delivering
    if (deliveryBoy.inDelivery) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot change availability while an active delivery is in progress"
      });
    }

    deliveryBoy.avail = avail;

    await deliveryBoy.save();
    return res.status(200).json({
      success: true,
      message: `Availability updated to ${
        avail ? "Available" : "Not Available"
      }`,
      avail
    });

  }catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
}

module.exports = {
  getDeliveryBoyProfile,
  updateAvail
};