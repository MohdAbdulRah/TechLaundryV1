const { Delivery } = require("../../Models/Delivery/Delivery");
const { Otp } = require("../../Models/OtpCode/OtpCode");
const User = require("../../Models/User/User");
const { Cart } = require("../../Models/Cart/Cart");
const {createResponse} = require("../../utils/Response")


const createDelivery = async (req, res) => {
    try {

        // ─── Auth Check ───────────────────────────────────────
        const authUser = req.user;

        if (!authUser || authUser.role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only users can create deliveries"
            });
        }

        // ─── Current User ─────────────────────────────────────
        const currUser = await User.findById(authUser.id);

        if (!currUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        

        // ─── Services ─────────────────────────────────────────
        const { services ,userLocation} = req.body;

        if (!services || !Array.isArray(services) || services.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Services are required"
            });
        }
        if (
    !userLocation ||
    !userLocation.coordinates ||
    userLocation.coordinates.length !== 2
) {
    return res.status(400).json({
        success: false,
        message: "Valid userLocation is required"
    });
}
        // Expected:
        // services: [
        //   {
        //      price: priceId,
        //      shop: shopId
        //   }
        // ]

        // ─── Find Nearest Delivery Boy ───────────────────────
        const nearestDeliveryBoy = await User.aggregate([
            {
                $geoNear: {
                    near: {
                        type: "Point",
                        coordinates: userLocation.coordinates
                    },
                    distanceField: "distance",
                    spherical: true,
                    query: {
                        role: "deliveryBoy",
                        inDelivery: false,
                        avail : true,

                        // ─── Location Must Exist ─────────────────
                        location: {
                            $exists: true,
                            $ne: null
                        },

                        "location.coordinates.0": { $exists: true },
                        "location.coordinates.1": { $exists: true }
                    }
                }
            },
            {
                $limit: 1
            }
        ]);

        if (!nearestDeliveryBoy.length) {
            return res.status(404).json({
                success: false,
                message: "No nearby delivery boy found"
            });
        }

        const deliveryBoy = nearestDeliveryBoy[0];
        await User.findByIdAndUpdate(
            deliveryBoy._id,
            {
                inDelivery: true
            }
        );
        // ─── Create Delivery ─────────────────────────────────
     const delivery = await Delivery.create({
    user: currUser._id,

    status: "started",

    userLocation: {
        type: "Point",
        coordinates: userLocation.coordinates
    },

    deliveryBoys: [
        {
            deliveryBoy: deliveryBoy._id,
            order: 0,
            status: "Pending"
        }
    ],

    services: services.map(service => ({
        price: service.price,
        shop: service.shop,
        quantity: service.quantity,

        // ─── Add This ─────────────────────
        status: "started"
    }))
});

        // ─── Populate ────────────────────────────────────────
        const populatedDelivery = await Delivery.findById(delivery._id)
    .populate("user")
    .populate("deliveryBoys.deliveryBoy")
    .populate("services.price")
    .populate("services.shop");

// ─── Empty User Cart ─────────────────────────────
await Cart.findOneAndUpdate(
    { user: currUser._id },
    { $set: { service: [] } }
);

return res.status(201).json({
    success: true,
    message: "Delivery created successfully",
    data: populatedDelivery
});

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const getDeliveryBoyDeliveries = async (req, res) => {
    try {

        const authUser = req.user;

        // ─── Role Check ───────────────────────────
        if (!authUser || authUser.role !== "deliveryBoy") {

            return res.status(403).json({
                success: false,
                message: "Only delivery boys can access deliveries"
            });

        }

        // ─── Fetch Deliveries ─────────────────────
        const deliveries = await Delivery.find({
                deliveryBoys: {
                    $elemMatch: {
                        deliveryBoy: authUser.id,
                        status: "Pending"
                    }
                }
            })
            .populate("user")
            .populate("deliveryBoys.deliveryBoy")
            .populate("services.price")
            .populate("services.shop")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Deliveries fetched successfully",
            data: deliveries
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

const getUserDeliveries = async (req, res) => {
    try {

        const authUser = req.user;

        // ─── Role Check ───────────────────────────
        if (!authUser || authUser.role !== "user") {

            return res.status(403).json({
                success: false,
                message: "Only users can access their deliveries"
            });

        }

        // ─── Fetch Deliveries ─────────────────────
        const deliveries = await Delivery.find({
            user: authUser.id
        })
            .populate("user")
            .populate("deliveryBoys.deliveryBoy")
            .populate("services.price")
            .populate("services.shop")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "User deliveries fetched successfully",
            data: deliveries
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
const getOtpForDelivery = async (req, res) => {
    try {

        const authUser = req.user;

        // ─── Role Check ─────────────────────────────
        if (!authUser || authUser.role !== "user") {
            return res.status(403).json({
                success: false,
                message: "Only users can get OTP"
            });
        }

        // ─── Body ───────────────────────────────────
        const { deliveryId } = req.body;

        if (!deliveryId) {
            return res.status(400).json({
                success: false,
                message: "deliveryId is required"
            });
        }

        // ─── Find Delivery ──────────────────────────
        const delivery = await Delivery.findById(deliveryId);

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: "Delivery not found"
            });
        }

        // ─── Ownership Check ────────────────────────
        if (delivery.user.toString() !== authUser.id) {
            return res.status(403).json({
                success: false,
                message: "Not authorized for this delivery"
            });
        }

        // ─── Current Pending DeliveryBoy ────────────
        const currentDeliveryBoy = delivery.deliveryBoys.find(
            item => item.status === "Pending"
        );

        if (!currentDeliveryBoy) {
            return res.status(404).json({
                success: false,
                message: "No pending delivery boy found"
            });
        }

        // ─── Find Existing OTP ──────────────────────
        const existingOtp = await Otp.findOne({
            delivery: deliveryId,
            user1: authUser.id,
            user2: currentDeliveryBoy.deliveryBoy,
            status: currentDeliveryBoy.order
        }).sort({ createdAt: -1 });

        if (!existingOtp) {
            return res.status(404).json({
                success: false,
                message: "OTP not found"
            });
        }

        // ─── Check Expiry ───────────────────────────
        const diffInMs =
            new Date().getTime() -
            new Date(existingOtp.createdAt).getTime();

        const diffInMinutes = diffInMs / (1000 * 60);

        if (diffInMinutes > 5) {
            return res.status(400).json({
                success: false,
                message: "OTP expired"
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP fetched successfully",
            data: existingOtp
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};
// ─────────────────────────────────────────────
// GET OTP FOR USER1
// user1 = req.user
// status = 1
// within 5 minutes
// ─────────────────────────────────────────────

const getOtpForGiveToUser = async (
  req,
  res
) => {

  try {

    const authUser = req.user;

    if (!authUser) {

      return createResponse(
        res,
        401,
        "Unauthorized",
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
        "OTP not found or expired",
        null,
        false
      );

    }

    return createResponse(
      res,
      200,
      "OTP fetched successfully",
      {
        otp: otp.otp
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
// ─────────────────────────────────────────────
// GET COMPLETED DELIVERIES OF CURRENT DELIVERY BOY
// ─────────────────────────────────────────────

const getCompletedDeliveriesOfDeliveryBoy =
  async (req, res) => {

    try {

      const authUser = req.user;

      // ─────────────────────────────
      // Only Delivery Boy
      // ─────────────────────────────

      if (
        !authUser ||
        authUser.role !== "deliveryBoy"
      ) {

        return createResponse(
          res,
          403,
          "Only delivery boys can access this",
          null,
          false
        );

      }

      // ─────────────────────────────
      // Fetch Deliveries
      // Only current delivery boy
      // status = Done
      // ─────────────────────────────

      const deliveries =
        await Delivery.find({

          deliveryBoys: {
            $elemMatch: {
              deliveryBoy: authUser.id,
              status: "Done"
            }
          }

        })
          .populate("user")
          .populate({
            path:
              "deliveryBoys.deliveryBoy",
            select:
              "firstName lastName phone"
          })
          .populate("services.price")
          .populate("services.shop")
          .sort({
            createdAt: -1
          });

      // ─────────────────────────────
      // Keep Only Current Delivery Boy
      // Add workDone field
      // ─────────────────────────────

      const formattedDeliveries =
        deliveries.map((delivery) => {

          const currentDeliveryBoy =
            delivery.deliveryBoys.find(
              (item) =>
                item.deliveryBoy._id.toString() ===
                  authUser.id.toString() &&
                item.status === "Done"
            );

          let workDone = "";

          // order 0
          if (
            currentDeliveryBoy.order === 0
          ) {

            workDone =
              "Transferred clothes from user to shop";

          }

          // order 1
          else if (
            currentDeliveryBoy.order === 1
          ) {

            workDone =
              "Transferred clothes from shop to user";

          }

          return {

            ...delivery.toObject(),

            // only current delivery boy
            deliveryBoys: [
              currentDeliveryBoy
            ],

            workDone

          };

        });

      return createResponse(
        res,
        200,
        "Completed deliveries fetched successfully",
        formattedDeliveries,
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
    createDelivery,
    getDeliveryBoyDeliveries,
    getUserDeliveries,
    getOtpForDelivery,
    getOtpForGiveToUser,
    getCompletedDeliveriesOfDeliveryBoy
};
