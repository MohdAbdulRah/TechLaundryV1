const mongoose = require("mongoose")

const otpSchema = new mongoose.Schema({
    user1 : { //get otp and says
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    user2 : {//verifies the otp
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    otp : {
        type : Number,
        required : true
    },
    delivery : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Delivery',
        required : true
    },
    status : {
        type : Number,
        required : true
    }

},{timestamps : true})


const Otp = mongoose.model('Otp',otpSchema)

module.exports = {Otp}