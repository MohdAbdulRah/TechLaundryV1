const mongoose = require('mongoose')

const priceCategorySchema = new mongoose.Schema({
    name : {
        type : String,
        required : true,
        unique : true
    }
},{timestamps : true})

const PriceCategory = mongoose.model('PriceCategory',priceCategorySchema)

module.exports = {PriceCategory}