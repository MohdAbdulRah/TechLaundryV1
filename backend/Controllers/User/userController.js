const {createResponse,generateToken} = require("../../utils/Response")
const User = require("../../Models/User/User")
const bcrypt = require('bcrypt');
const axios = require("axios"); 

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; 
    
    if (!identifier || !password) {
      return createResponse(res, 400, "Username/Email and Password are required", null, false);
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier }
      ]
    });

    if (!user) {
      return createResponse(res, 404, "User not found", null, false);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return createResponse(res, 401, "Invalid credentials", null, false);
    }

    const token = generateToken(user);

    return createResponse(res, 200, "Login Successful", {
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    }, true);

  } catch (err) {
    return createResponse(res, 400, err.message, null, false);
  }
};

const signup = async (req, res) => {
  try {
    const { username, email, phone, password, firstName, lastName, address, role } = req.body;

    if (role === "admin") {
      return createResponse(res, 403, "You are not authorized to login as admin", null, false);
    }
    const oldUser = await User.findOne({email})
    if(oldUser){
        return createResponse(res, 409, "Already Email Exists", null, false);
    }
    const userUser = await User.findOne({username})
    if(userUser){
        return createResponse(res, 409, "Already UserName Exists", null, false);
    }
    const salt = parseInt(process.env.SALT); // important
    const user = new User({ username, email, phone, firstName, lastName, address, role });

    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const token = generateToken(user);

    return createResponse(res, 201, "Signup and Login Successful", { token }, true);

  } catch (err) {
    return createResponse(res, 400, err.message, null, false);
  }
};


const addLocation = async (req, res) => {
  try {
    const { location } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    user.location = location;

    // Reverse geocode to get address from coordinates
    // GeoJSON coordinates are [longitude, latitude]
    const [lng, lat] = location.coordinates;
try {
  const { data: geoData } = await axios.get(
    `https://api.bigdatacloud.net/data/reverse-geocode-client`,
    {
      params: {
        latitude: lat,
        longitude: lng,
        localityLanguage: "en",
      },
      timeout: 5000,
    }
  );
  console.log("Geocode response:", geoData);
  // Build a readable address from the response fields
  const address = [
    geoData.locality,
    geoData.city,
    geoData.principalSubdivision,
    geoData.countryName,
  ]
    .filter(Boolean)
    .join(", ");

  if (address) {
    user.address = address;
  }
} catch (geoErr) {
  console.warn("Reverse geocoding failed:", geoErr.message);
}

    await user.save();
    return createResponse(res, 201, "Location added successfully", { user }, true);
  } catch (err) {
    return createResponse(res, 401, err.message, null, false);
  }
};
const getLocation = async (req,res) => {

  try{
     const userId = req.user.id 
      const user = await User.findById(userId)
      return createResponse(res, 201, "Location fetched Successful", { user }, true);
  }
  catch(err){
    return createResponse(res, 401, err.message, null, false);
  }
}
const updateLiveLocation = async (req, res) => {

  try {

    const { coordinates, deliveryId } = req.body;

    const userId = req.user.id;

    // Update delivery boy location
    const user = await User.findByIdAndUpdate(
      userId,
      {
        location: {
          type: "Point",
          coordinates
        }
      },
      { new: true }
    );

    // Emit realtime location
    const io = req.app.get("io");

    io.to(deliveryId).emit(
      "delivery-live-location",
      {
        deliveryId,
        coordinates
      }
    );

    return createResponse(
      res,
      200,
      "Live location updated",
      user,
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
module.exports = {login,signup,addLocation,getLocation,updateLiveLocation}