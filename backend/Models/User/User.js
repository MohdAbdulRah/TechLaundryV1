const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    username : {
        type : String,
        required : true,
        unique : true
    },
    email : {
        type : String,
        required : true,
        unique : true
    },
    phone : {
        type : String,
        unique : true,
        sparse : true
    },
    password : {
        type : String,
        required : true
    },
    firstName : {
        type : String,
        required : true
    },
    lastName : {
        type : String
    },
    location: {
        type: {
            type: String,
            enum: ["Point"], 
           
        },
        coordinates: {
            type: [Number], 
           
        }
    },
    address : {
        type : String
    },
    role : {
       type : String,
       enum : ["admin","user","deliveryBoy","shopOwner"],
       required : true
    },
    shop : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Shop'
    },
    inDelivery: {
    type: Boolean,
    default: false
    },
    avail : {
        type : Boolean,
        default : true
    }
})
userSchema.index({ location: "2dsphere" });
const User = mongoose.model("User",userSchema)

module.exports = User