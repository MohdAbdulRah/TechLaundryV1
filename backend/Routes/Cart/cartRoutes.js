const express = require("express");

const router = express.Router();

const {
    addToCart,
    editCart,
    deleteCartItem,
    getCart
} = require("../../Controllers/Cart/cartController");





// =====================================
// ADD ITEM TO CART
// =====================================
router.post(
    "/add",
    
    addToCart
);



// =====================================
// EDIT CART ITEM
// =====================================
router.put(
    "/edit",

    editCart
);



// =====================================
// DELETE ITEM FROM CART
// =====================================
router.delete(
    "/delete",
  
    deleteCartItem
);



// =====================================
// GET USER CART
// =====================================
router.get(
    "/",
 
    getCart
);



module.exports = router;