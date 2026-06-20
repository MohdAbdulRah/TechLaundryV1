const mongoose = require('mongoose')

const shopSchema = new mongoose.Schema({
    name : {
        type : String,
        required : true
    },
    address : {
        type : String,
        required : true
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
    prices : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Price'
    }],
    rating : {
        type : Number,
        default:0,
        min : 0,
        max : 5
    },
    ratingCount: {
    type: Number,
    default: 0
   },
    totalOrders : {
        type : Number,
        min : 0
    },
    avgDeliveryTime : {
        type : Number,
        min : 0
    }
})
shopSchema.index({ location: "2dsphere" });
const Shop = mongoose.model('Shop',shopSchema)

module.exports = Shop