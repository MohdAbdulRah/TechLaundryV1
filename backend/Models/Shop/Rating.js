const mongoose = require('mongoose')

const ratingSchema = new mongoose.Schema({
    ratingNumber : {
        type : Number,
        min : 1,
        max : 5
    },
    shop : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Shop'
    },
    comment : {
        type : String
    },
    user : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
    }
})

const Rating = mongoose.model('Rating',ratingSchema)

module.exports = Rating