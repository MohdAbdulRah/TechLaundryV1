const express = require('express');
require('dotenv').config();

const cors = require('cors');
const mongoose = require('mongoose');

const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(express.json());
app.use(cors());

/* ─────────────────────────────────────────────
   Create HTTP Server
───────────────────────────────────────────── */

const server = http.createServer(app);

/* ─────────────────────────────────────────────
   Socket.IO
───────────────────────────────────────────── */

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* ─────────────────────────────────────────────
   Store io globally
───────────────────────────────────────────── */

app.set("io", io);

/* ─────────────────────────────────────────────
   Socket Events
───────────────────────────────────────────── */

io.on("connection", (socket) => {

  console.log("Socket Connected:", socket.id);

  // Join delivery room
  socket.on("join-delivery", (deliveryId) => {

    socket.join(deliveryId);

    console.log(
      `Socket ${socket.id} joined ${deliveryId}`
    );

  });

  socket.on(
    "update-location",
    async ({
      deliveryBoyId,
      deliveryId,
      coordinates
    }) => {

      try {

        // Save latest location
        await User.findByIdAndUpdate(
          deliveryBoyId,
          {
            location: {
              type: "Point",
              coordinates
            }
          }
        );

        // Send to user screen
        io.to(deliveryId).emit(
          "delivery-location-updated",
          {
            deliveryBoyId,
            deliveryId,
            coordinates
          }
        );

      } catch (err) {
        console.log(err);
      }

    }
  );
  socket.on("disconnect", () => {

    console.log(
      "Socket Disconnected:",
      socket.id
    );

  });

});

/* ─────────────────────────────────────────────
   Routes
───────────────────────────────────────────── */

const userRoutes = require("./Routes/User/userRoutes");
const shopRoutes = require("./Routes/Shop/shopRoutes");
const shopPriceRoutes = require("./Routes/Shop/shopPriceRoutes");
const generalUserRoutes = require("./Routes/GeneralUser/generalUserRoutes");
const cartRoutes = require("./Routes/Cart/cartRoutes");
const adminRoutes = require("./Routes/Admin/adminRoutes");
const adminShopRoutes = require("./Routes/Admin/shopRoutes");
const adminUserRoutes = require("./Routes/Admin/userRoutes");
const deliveryRoutes = require("./Routes/Delivery/deliveryRoutes");
const messageRoutes = require("./Routes/Message/messageRoutes");
const otpRoutes = require("./Routes/Otp/otpRoute");
const ratingRoutes = require("./Routes/Rating/ratingRoutes");
const deliveryBoyRoutes = require("./Routes/DeliveryBoy/deliveryBoyRoutes");
const {
  authMiddleware,
  shopMiddleWare,
  adminMiddleWare,
  deliveryBoyMiddleware
} = require("./middlewares/authMiddleWare");

app.use("/api/users", userRoutes);

app.use(
  "/api/shop",
  shopMiddleWare,
  shopRoutes
);

app.use(
  "/api/shop/price",
  shopMiddleWare,
  shopPriceRoutes
);

app.use(
  "/api/general",
  authMiddleware,
  generalUserRoutes
);

app.use(
  "/api/cart",
  authMiddleware,
  cartRoutes
);

app.use(
  "/api/admin",
  adminMiddleWare,
  adminRoutes
);
app.use(
  "/api/admin/shop",
  adminMiddleWare,
  adminShopRoutes
);
app.use(
  "/api/admin/user",
  adminMiddleWare,
  adminUserRoutes
);

app.use(
  "/api/delivery",
  authMiddleware,
  deliveryRoutes
);

app.use(
  "/api/msg",
  authMiddleware,
  messageRoutes
);

app.use(
  "/api/otp",
  deliveryBoyMiddleware,
  otpRoutes
);

app.use(
  "/api/rating",
  authMiddleware,
  ratingRoutes
)

app.use(
  "/api/boy",
  deliveryBoyMiddleware,
  deliveryBoyRoutes
)
/* ─────────────────────────────────────────────
   MongoDB
───────────────────────────────────────────── */

async function main() {

  await mongoose.connect(
    'mongodb://127.0.0.1:27017/techLaundry'
  );

}

main()
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* ─────────────────────────────────────────────
   Start Server
───────────────────────────────────────────── */

const port = process.env.PORT || 5000;

server.listen(port, () => {

  console.log(
    `Server listening on ${port}`
  );

});

