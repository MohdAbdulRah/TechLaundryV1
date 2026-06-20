const jwt = require("jsonwebtoken");

const createResponse = (res, status = 200, message = "", data = null, success = true) => {
    return res.status(status).json({
        status,
        success,
        message,
        data
    });
};

function generateToken(user){
     const secretKey = process.env.SECRET_KEY
     return jwt.sign(
        {
            id: user._id,
            email: user.email,
            username : user.username,
            role : user.role,
            firstName : user.firstName
        },
        secretKey,
        { expiresIn: "1d" }
    );
}
module.exports = {createResponse,generateToken}