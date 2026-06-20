const { Otp } = require("../../Models/OtpCode/OtpCode");
const { Delivery } = require("../../Models/Delivery/Delivery");
const  Shop  = require("../../Models/Shop/Shop");
const User = require("../../Models/User/User");
const {createResponse} = require("../../utils/Response")

const createOtpCode = async (req, res) => {
    try {

        const authUser = req.user;

        // ─── Only Delivery Boy ─────────────────────
        if (!authUser || authUser.role !== "deliveryBoy") {

            return res.status(403).json({
                success: false,
                message: "Only delivery boys can create OTP"
            });

        }

        const { deliveryId, user1 } = req.body;

        if (!deliveryId || !user1) {

            return res.status(400).json({
                success: false,
                message: "deliveryId and user1 are required"
            });

        }

        // ─── Find Delivery ─────────────────────────
        const delivery = await Delivery.findById(deliveryId);

        if (!delivery) {

            return res.status(404).json({
                success: false,
                message: "Delivery not found"
            });

        }

        // ─── Find Delivery Boy Entry ───────────────
        const deliveryBoyEntry =
            delivery.deliveryBoys.find(
                item =>
                    item.deliveryBoy.toString() ===
                    authUser.id
            );

        if (!deliveryBoyEntry) {

            return res.status(403).json({
                success: false,
                message:
                    "You are not assigned to this delivery"
            });

        }

        // ─── Generate OTP ──────────────────────────
        const otp = Math.floor(
            100000 + Math.random() * 900000
        );

        // ─── Create OTP Document ───────────────────
        const otpDoc = await Otp.create({
            user1,
            user2: authUser.id,
            otp,
            delivery: deliveryId,

            // order of delivery boy becomes status
            status: deliveryBoyEntry.order
        });

        return res.status(201).json({
            success: true,
            message: "OTP created successfully",
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

const verifyOtpByDeliveryBoyForCollectionOfServices = async (req, res) => {
    try {

        const authUser = req.user;

        // ─── Role Check ───────────────────────────────
        if (!authUser || authUser.role !== "deliveryBoy") {
            return res.status(403).json({
                success: false,
                message: "Only delivery boys can verify OTP"
            });
        }

        // ─── Body ─────────────────────────────────────
        const { otp, deliveryId } = req.body;

        if (!otp || !deliveryId) {
            return res.status(400).json({
                success: false,
                message: "otp and deliveryId are required"
            });
        }

        // ─── Find OTP ─────────────────────────────────
        const otpDoc = await Otp.findOne({
            otp,
            delivery: deliveryId,
            user2: authUser.id
        });

        if (!otpDoc) {
            return res.status(404).json({
                success: false,
                message: "Invalid OTP"
            });
        }

        // ─── Check Expiry (5 minutes) ─────────────────
        const now = new Date();

        const diffInMs =
            now.getTime() - new Date(otpDoc.createdAt).getTime();

        const diffInMinutes = diffInMs / (1000 * 60);

        if (diffInMinutes > 5) {
            return res.status(400).json({
                success: false,
                message: "OTP expired"
            });
        }

        // ─── Find Delivery ────────────────────────────
        const delivery = await Delivery.findById(deliveryId);

        if (!delivery) {
            return res.status(404).json({
                success: false,
                message: "Delivery not found"
            });
        }

        // ─── Find Current DeliveryBoy Entry ───────────
        const currentDeliveryBoy =
            delivery.deliveryBoys.find(
                item =>
                    item.deliveryBoy.toString() === authUser.id &&
                    item.order === otpDoc.status
            );

        if (!currentDeliveryBoy) {
            return res.status(404).json({
                success: false,
                message: "Delivery boy entry not found"
            });
        }

  

        

            // Main Delivery Status
            delivery.status = "collected_from_user";

            // All Service Statuses
            delivery.services.forEach(service => {
                service.status = "collected_from_user";
            });

        await delivery.save();

        // ─── Delete OTP After Verification ────────────
        await Otp.findByIdAndDelete(otpDoc._id);

        // ─── Populate ─────────────────────────────────
        const populatedDelivery = await Delivery.findById(delivery._id)
            .populate("user")
            .populate("deliveryBoys.deliveryBoy")
            .populate("services.price")
            .populate("services.shop");

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully",
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
const createOtpForShopCollection = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Delivery Boy
    // ─────────────────────────────────────────────

    if (!authUser || authUser.role !== "deliveryBoy") {
      return createResponse(
        res,
        403,
        "Only delivery boys can create OTP",
        null,
        false
      );
    }

    const { deliveryId, shopId } = req.body;

    if (!deliveryId || !shopId) {
      return createResponse(
        res,
        400,
        "deliveryId and shopId are required",
        null,
        false
      );
    }

    // ─────────────────────────────────────────────
    // Find Delivery
    // ─────────────────────────────────────────────

    const delivery = await Delivery.findById(deliveryId)
  .populate("services.shop");

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
    // Delivery Status Check
    // Only when collected_from_user
    // ─────────────────────────────────────────────

    if (delivery.status !== "collected_from_user") {
      return createResponse(
        res,
        400,
        "OTP can only be created after collection from user",
        null,
        false
      );
    }

    // ─────────────────────────────────────────────
    // Delivery Boy Validation
    // Must exist in deliveryBoys array
    // and status should be Pending
    // ─────────────────────────────────────────────

    const deliveryBoyEntry = delivery.deliveryBoys.find(
  (d) =>
    d.deliveryBoy &&
    d.deliveryBoy.toString() === authUser.id.toString() &&
    d.status === "Pending"
);

    if (!deliveryBoyEntry) {
      return createResponse(
        res,
        403,
        "You are not assigned or already completed",
        null,
        false
      );
    }

    // ─────────────────────────────────────────────
    // Find Services of This Shop
    // ─────────────────────────────────────────────

    const servicesForShop = delivery.services.filter(
  (service) => {

    if (!service.shop) return false;

    const currentShopId =
      service.shop._id
        ? service.shop._id.toString()
        : service.shop.toString();

    return currentShopId === shopId;

  }
);

    if (servicesForShop.length === 0) {
      return createResponse(
        res,
        404,
        "No services found for this shop",
        null,
        false
      );
    }

    // ─────────────────────────────────────────────
    // Find Shop Owner
    // ─────────────────────────────────────────────

    const shopOwner = await User.findOne({
      role: "shopOwner",
      shop: shopId
    });

    if (!shopOwner) {
      return createResponse(
        res,
        404,
        "Shop owner not found",
        null,
        false
      );
    }

    // ─────────────────────────────────────────────
    // Prevent Duplicate OTP
    // One active OTP per shop per delivery
    // ─────────────────────────────────────────────

    const existingOtp = await Otp.findOne({
  delivery: deliveryId,
  user1: shopOwner._id,
  user2: authUser.id,
  status: 0,
  createdAt: {
    $gte: new Date(Date.now() - 5 * 60 * 1000) // last 5 mins
  }
});

if (existingOtp) {

  return createResponse(
    res,
    200,
    "OTP already exists and is valid for 5 minutes",
    existingOtp,
    true
  );

}

    // ─────────────────────────────────────────────
    // Generate OTP
    // ─────────────────────────────────────────────

    const otpCode =
      Math.floor(100000 + Math.random() * 900000);

    const otp = new Otp({
      user1: shopOwner._id, // shop owner
      user2: authUser.id, // delivery boy
      otp: otpCode,
      delivery: delivery._id,
      status: 0
    });

    await otp.save();

    // ─────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────

    return createResponse(
      res,
      201,
      "OTP created successfully",
      {
        shopId,
        deliveryId,
        totalServices: servicesForShop.length
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
const verifyOtpForShopCollection = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Delivery Boy
    // ─────────────────────────────────────────────

    if (!authUser || authUser.role !== "deliveryBoy") {

      return createResponse(
        res,
        403,
        "Only delivery boys can verify OTP",
        null,
        false
      );

    }

    const { otp, deliveryId, shopId } = req.body;

    // ─────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────

    if (!otp || !deliveryId || !shopId) {

      return createResponse(
        res,
        400,
        "otp, deliveryId and shopId are required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find OTP
    // ─────────────────────────────────────────────

    const otpDoc = await Otp.findOne({
      otp,
      delivery: deliveryId,
      user2: authUser.id,
      status: 0
    });

    if (!otpDoc) {

      return createResponse(
        res,
        404,
        "Invalid OTP",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Check Expiry (5 mins)
    // ─────────────────────────────────────────────

    const diffInMs =
      Date.now() - new Date(otpDoc.createdAt).getTime();

    const diffInMinutes = diffInMs / (1000 * 60);

    if (diffInMinutes > 5) {

      return createResponse(
        res,
        400,
        "OTP expired",
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
    // Validate Delivery Boy
    // ─────────────────────────────────────────────

    const deliveryBoyEntry = delivery.deliveryBoys.find(
      (item) =>
        item.deliveryBoy.toString() === authUser.id.toString() &&
        item.order === 0 &&
        item.status === "Pending"
    );

    if (!deliveryBoyEntry) {

      return createResponse(
        res,
        403,
        "You are not assigned to this delivery",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Services Of This Shop
    // and update status
    // ─────────────────────────────────────────────

    let updatedServices = 0;

    delivery.services.forEach((service) => {

      if (
        service.shop &&
        service.shop.toString() === shopId &&
        service.status === "collected_from_user"
      ) {

        service.status = "given_to_shop";
        updatedServices++;

      }

    });

    if (updatedServices === 0) {

      return createResponse(
        res,
        404,
        "No eligible services found for this shop",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Check If All Services Are Given To Shop
    // ─────────────────────────────────────────────

    const allServicesGivenToShop =
      delivery.services.every(
        (service) =>
          service.status === "given_to_shop"
      );

    if (allServicesGivenToShop) {

      // Main delivery status
      delivery.status = "given_to_shops";

      // Delivery boy status done
      deliveryBoyEntry.status = "Done";

      // Make delivery boy available again
      await User.findByIdAndUpdate(
        authUser.id,
        {
          inDelivery: false
        }
      );

    }

    // ─────────────────────────────────────────────
    // Save Delivery
    // ─────────────────────────────────────────────

    await delivery.save();

    // ─────────────────────────────────────────────
    // Delete OTP
    // ─────────────────────────────────────────────

    await Otp.findByIdAndDelete(otpDoc._id);

    // ─────────────────────────────────────────────
    // Populate Updated Delivery
    // ─────────────────────────────────────────────

    const populatedDelivery =
      await Delivery.findById(delivery._id)
        .populate("user")
        .populate("deliveryBoys.deliveryBoy")
        .populate("services.price")
        .populate("services.shop");

    // ─────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────

    return createResponse(
      res,
      200,
      "OTP verified successfully",
      populatedDelivery,
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
const createOtpForCollectionFromShop = async (req, res) => {
  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Delivery Boy
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "deliveryBoy"
    ) {

      return createResponse(
        res,
        403,
        "Only delivery boys can create OTP",
        null,
        false
      );

    }

    const { deliveryId, shopId } = req.body;

    // ─────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────

    if (!deliveryId || !shopId) {

      return createResponse(
        res,
        400,
        "deliveryId and shopId are required",
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
    // Delivery Boy Validation
    // ─────────────────────────────────────────────

    const deliveryBoyEntry =
      delivery.deliveryBoys.find(
        (item) =>
          item.deliveryBoy.toString() ===
            authUser.id.toString() &&
          item.status === "Pending"
      );

    if (!deliveryBoyEntry) {

      return createResponse(
        res,
        403,
        "You are not assigned to this delivery",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Services Of Same Shop
    // ─────────────────────────────────────────────

    const servicesForShop =
      delivery.services.filter((service) => {

        if (!service.shop) return false;

        const currentShopId =
          service.shop._id
            ? service.shop._id.toString()
            : service.shop.toString();

        return currentShopId === shopId;

      });

    if (servicesForShop.length === 0) {

      return createResponse(
        res,
        404,
        "No services found for this shop",
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
        "All services must be completed before OTP generation",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Shop Owner
    // ─────────────────────────────────────────────

    const shopOwner = await User.findOne({
      role: "shopOwner",
      shop: shopId
    });

    if (!shopOwner) {

      return createResponse(
        res,
        404,
        "Shop owner not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Prevent Duplicate OTP Within 5 Minutes
    // ─────────────────────────────────────────────

    const existingOtp = await Otp.findOne({
      delivery: deliveryId,
      user1: shopOwner._id,
      user2: authUser.id,
      status: 1,
      createdAt: {
        $gte: new Date(
          Date.now() - 5 * 60 * 1000
        )
      }
    });

    if (existingOtp) {

      return createResponse(
        res,
        200,
        "OTP already exists and is valid for 5 minutes",
        existingOtp,
        true
      );

    }

    // ─────────────────────────────────────────────
    // Generate OTP
    // ─────────────────────────────────────────────

    const otpCode =
      Math.floor(
        100000 + Math.random() * 900000
      );

    // ─────────────────────────────────────────────
    // Create OTP
    // status = 1 means collection from shop
    // ─────────────────────────────────────────────

    const otp = await Otp.create({
      user1: shopOwner._id,
      user2: authUser.id,
      otp: otpCode,
      delivery: delivery._id,
      status: 1
    });

    // ─────────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────────

    return createResponse(
      res,
      201,
      "OTP created successfully",
      {
        otpId: otp._id,
        deliveryId,
        shopId,
        totalServices:
          servicesForShop.length
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
const verifyOtpForCollectionFromShop =
  async (req, res) => {

    try {

      const authUser = req.user;

      // ─────────────────────────────────────────────
      // Only Delivery Boy
      // ─────────────────────────────────────────────

      if (
        !authUser ||
        authUser.role !== "deliveryBoy"
      ) {

        return createResponse(
          res,
          403,
          "Only delivery boys can verify OTP",
          null,
          false
        );

      }

      const { deliveryId, otpCode } =
        req.body;

      // ─────────────────────────────────────────────
      // Validation
      // ─────────────────────────────────────────────

      if (!deliveryId || !otpCode) {

        return createResponse(
          res,
          400,
          "deliveryId and otpCode are required",
          null,
          false
        );

      }

      // ─────────────────────────────────────────────
      // Find Delivery
      // ─────────────────────────────────────────────

      const delivery =
        await Delivery.findById(
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
      // Validate Delivery Boy
      // ─────────────────────────────────────────────

      const deliveryBoyEntry =
        delivery.deliveryBoys.find(
          (item) =>
            item.deliveryBoy.toString() ===
              authUser.id.toString() &&
            item.status === "Pending"
        );

      if (!deliveryBoyEntry) {

        return createResponse(
          res,
          403,
          "You are not assigned to this delivery",
          null,
          false
        );

      }

      // ─────────────────────────────────────────────
      // Find Valid OTP
      // status = 1 => collection from shop
      // ─────────────────────────────────────────────

      const otp = await Otp.findOne({
        delivery: deliveryId,
        user2: authUser.id,
        otp: otpCode,
        status: 1,
        createdAt: {
          $gte: new Date(
            Date.now() - 5 * 60 * 1000
          )
        }
      });

      if (!otp) {

        return createResponse(
          res,
          400,
          "Invalid or expired OTP",
          null,
          false
        );

      }

      // ─────────────────────────────────────────────
      // Find Shop Owner
      // ─────────────────────────────────────────────

      const shopOwner =
        await User.findById(otp.user1);

      if (
        !shopOwner ||
        !shopOwner.shop
      ) {

        return createResponse(
          res,
          404,
          "Shop owner not found",
          null,
          false
        );

      }

      // ─────────────────────────────────────────────
      // Update Services Of This Shop
      // ONLY IF status === service_done
      // ─────────────────────────────────────────────

      let updatedCount = 0;

      delivery.services =
        delivery.services.map((service) => {

          const currentShopId =
            service.shop._id
              ? service.shop._id.toString()
              : service.shop.toString();

          if (
            currentShopId ===
              shopOwner.shop.toString() &&
            service.status ===
              "service_done"
          ) {

            updatedCount++;

            return {
              ...service.toObject(),
              status:
                "collected_from_shop",
            };

          }

          return service;

        });

      if (updatedCount === 0) {

        return createResponse(
          res,
          400,
          "No completed services found for this shop",
          null,
          false
        );

      }

      // ─────────────────────────────────────────────
      // Check All Services Collected
      // ─────────────────────────────────────────────

      const allCollected =
        delivery.services.every(
          (service) =>
            service.status ===
            "collected_from_shop"
        );

      const shop = await Shop.findById(shopOwner.shop);

if (shop) {

  const deliveryTimeMinutes =
    (Date.now() - new Date(delivery.createdAt).getTime()) /
    (1000 * 60);

  const previousOrders = shop.totalOrders || 0;
  const previousAvg = shop.avgDeliveryTime || 0;

  const newTotalOrders = previousOrders + 1;

  const newAvgDeliveryTime =
    ((previousAvg * previousOrders) + deliveryTimeMinutes) /
    newTotalOrders;

  shop.totalOrders = newTotalOrders;
  shop.avgDeliveryTime = Number(
    newAvgDeliveryTime.toFixed(2)
  );

  await shop.save();
}
      if (allCollected) {

        delivery.status =
          "collected_from_shops";

      }

      // ─────────────────────────────────────────────
      // Save Delivery
      // ─────────────────────────────────────────────

      await delivery.save();

      // ─────────────────────────────────────────────
      // Delete OTP After Successful Verification
      // ─────────────────────────────────────────────

      await Otp.findByIdAndDelete(
        otp._id
      );

      // ─────────────────────────────────────────────
      // Response
      // ─────────────────────────────────────────────
      const updatedDelivery = await Delivery.findById(delivery._id)
  .populate({
    path: "user",
    populate: {
      path: "shop"
    }
  })
  .populate({
    path: "deliveryBoys.deliveryBoy",
    populate: {
      path: "shop"
    }
  })
  .populate("services.price")
  .populate("services.shop");
      return createResponse(
        res,
        200,
        "OTP verified successfully",
        updatedDelivery,
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

const createOtpForGiveToUser = async (
  req,
  res
) => {

  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Delivery Boy
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "deliveryBoy"
    ) {

      return createResponse(
        res,
        403,
        "Only delivery boys can create OTP",
        null,
        false
      );

    }

    const { deliveryId } = req.body;

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

    const delivery =
      await Delivery.findById(
        deliveryId
      );

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
    // Delivery Must Be Ready
    // ─────────────────────────────────────────────

    if (
      delivery.status !==
      "collected_from_shops"
    ) {

      return createResponse(
        res,
        400,
        "Delivery is not ready to give user",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Delivery Boy With Order 1
    // ─────────────────────────────────────────────

    const deliveryBoyEntry =
      delivery.deliveryBoys.find(
        (item) =>
          item.order === 1
      );

    if (!deliveryBoyEntry) {

      return createResponse(
        res,
        404,
        "Delivery boy not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Only Assigned Delivery Boy Can Create OTP
    // ─────────────────────────────────────────────

    if (
      deliveryBoyEntry.deliveryBoy.toString() !==
      authUser.id.toString()
    ) {

      return createResponse(
        res,
        403,
        "You are not allowed",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Remove Old OTPs
    // status = 2 => give to user
    // ─────────────────────────────────────────────

    await Otp.deleteMany({
      delivery: deliveryId,
      status: 1,
    });

    // ─────────────────────────────────────────────
    // Generate OTP
    // ─────────────────────────────────────────────

    const otpCode = Math.floor(
      100000 + Math.random() * 900000
    );

    // ─────────────────────────────────────────────
    // Create OTP
    // user1 = delivery user
    // user2 = delivery boy order 1
    // status = 2
    // ─────────────────────────────────────────────

    const otp = await Otp.create({

      user1: delivery.user,

      user2:
        deliveryBoyEntry.deliveryBoy,

      otp: otpCode,

      delivery: delivery._id,

      status: 1,

    });

    return createResponse(
      res,
      200,
      "OTP created successfully",
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
// ─────────────────────────────────────────────
// VERIFY OTP FOR GIVE TO USER
// ─────────────────────────────────────────────

const verifyOtpForGiveToUser = async (
  req,
  res
) => {

  try {

    const authUser = req.user;

    // ─────────────────────────────────────────────
    // Only Delivery Boy
    // ─────────────────────────────────────────────

    if (
      !authUser ||
      authUser.role !== "deliveryBoy"
    ) {

      return createResponse(
        res,
        403,
        "Only delivery boys can verify OTP",
        null,
        false
      );

    }

    const {
      deliveryId,
      otpCode
    } = req.body;

    // ─────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────

    if (
      !deliveryId ||
      !otpCode
    ) {

      return createResponse(
        res,
        400,
        "deliveryId and otpCode are required",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Delivery
    // ─────────────────────────────────────────────

    const delivery =
      await Delivery.findById(
        deliveryId
      );

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
    // Find Delivery Boy With Order 1
    // ─────────────────────────────────────────────

    const deliveryBoyEntry =
      delivery.deliveryBoys.find(
        (item) =>
          item.order === 1
      );

    if (!deliveryBoyEntry) {

      return createResponse(
        res,
        404,
        "Delivery boy not found",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Only Assigned Delivery Boy
    // ─────────────────────────────────────────────

    if (
      deliveryBoyEntry.deliveryBoy.toString() !==
      authUser.id.toString()
    ) {

      return createResponse(
        res,
        403,
        "You are not allowed",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Find Valid OTP
    // status = 1 => give to user
    // ─────────────────────────────────────────────

    const otp = await Otp.findOne({

      delivery: deliveryId,

      user2: authUser.id,

      otp: otpCode,

      status: 1,

      createdAt: {
        $gte: new Date(
          Date.now() - 5 * 60 * 1000
        )
      }

    });

    if (!otp) {

      return createResponse(
        res,
        400,
        "Invalid or expired OTP",
        null,
        false
      );

    }

    // ─────────────────────────────────────────────
    // Update Delivery Status
    // ─────────────────────────────────────────────

    delivery.status =
      "given_to_user";

    delivery.services =
      delivery.services.map(
        (service) => ({
          ...service.toObject(),
          status:
            "given_to_user"
        })
      );

// ─────────────────────────────────────────────
// Update Delivery Boy Status
// ─────────────────────────────────────────────

delivery.deliveryBoys =
  delivery.deliveryBoys.map(
    (item) => {

      if (
        item.deliveryBoy.toString() ===
        authUser.id.toString()
      ) {

        return {
          ...item.toObject(),
          status: "Done"
        };

      }

      return item;

    }
  );

// ─────────────────────────────────────────────
// Update Delivery Boy inDelivery = false
// ─────────────────────────────────────────────

await User.findByIdAndUpdate(
  authUser.id,
  {
    inDelivery: false
  }
);

// ─────────────────────────────────────────────
// Save Delivery
// ─────────────────────────────────────────────

await delivery.save();

    // ─────────────────────────────────────────────
    // Delete OTP
    // ─────────────────────────────────────────────

    await Otp.findByIdAndDelete(
      otp._id
    );

    // ─────────────────────────────────────────────
    // Populate Updated Delivery
    // ─────────────────────────────────────────────

    const updatedDelivery =
      await Delivery.findById(
        delivery._id
      )
        .populate({
          path: "user",
          populate: {
            path: "shop"
          }
        })
        .populate({
          path:
            "deliveryBoys.deliveryBoy",
          populate: {
            path: "shop"
          }
        })
        .populate("services.price")
        .populate("services.shop");

    return createResponse(
      res,
      200,
      "OTP verified successfully",
      updatedDelivery,
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
    createOtpCode,
    verifyOtpByDeliveryBoyForCollectionOfServices,
    createOtpForShopCollection,
    verifyOtpForShopCollection,
    createOtpForCollectionFromShop,
    verifyOtpForCollectionFromShop,
    createOtpForGiveToUser,
    verifyOtpForGiveToUser
};