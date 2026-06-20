const mongoose = require("mongoose")
const cartSchema = new mongoose.Schema({
    service : [
    {
        price : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Price',
            required : true
        },
        shop : {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'Shop',
            required : true
        },
        quantity : {
            type : Number,
            required : true
        }
    }],
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
    }

})

const Cart = mongoose.model('Cart',cartSchema)

module.exports = {Cart}