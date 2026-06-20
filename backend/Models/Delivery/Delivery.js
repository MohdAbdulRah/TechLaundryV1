const mongoose = require("mongoose")

const deliverySchema = new mongoose.Schema({
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
    },
    deliveryBoys : [
        {
        deliveryBoy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
       },
       order : {
         type : Number,
         default : 0
       },
       status : {
         type : String,
         enum : ["Done","Pending"]
       }
       
    }
    ],
    status : {
        type : String,
        enum : ["started","collected_from_user","given_to_shops","service_done","collected_from_shops","given_to_user"]
    },
    services : [
        {
            price : {
                type : mongoose.Schema.Types.ObjectId,
                ref : 'Price'
            },
            shop : {
                type : mongoose.Schema.Types.ObjectId,
                ref : 'Shop'
            },
            quantity : {
                type : Number,
                required : true,
                min : 1,
                default : 1
            },
            status : {
               type : String,
               enum : ["started","collected_from_user","given_to_shop","service_done","collected_from_shop","given_to_user"]
            }
        }
    ],
 userLocation: {
    type: {
      type: String, 
      enum: ['Point'], // Must be 'Point'
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  }
},{timestamps : true})


const Delivery = mongoose.model('Delivery',deliverySchema)

module.exports = {Delivery}