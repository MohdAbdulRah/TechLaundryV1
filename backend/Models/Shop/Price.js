const mongoose = require("mongoose")
const PRICE_CATEGORIES = require("../../utils/priceCategories")
const priceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  charge: {
    type: Number,
    min: 0,
    required: true,
    default: 0
  },

  picture: {
    type: String
  },

  icon: {
    type: String
  },

  category: {
    type : mongoose.Schema.Types.ObjectId,
    ref : 'PriceCategory'
  },
  timesOrdered: {
     type : Number,
     min : 0
  },
  avgReview: {
    type : Number,
    min : 0
  },
  expressAvailable: {
    type : Boolean
  }
});

const Price = mongoose.model('Price',priceSchema)

module.exports = Price