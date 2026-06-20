const mongoose = require("mongoose");

const { Cart } = require("../../Models/Cart/Cart");
const Price = require("../../Models/Shop/Price");
const Shop = require("../../Models/Shop/Shop");

const { createResponse } = require("../../utils/Response");



// =====================================
// ADD ITEM TO CART
// =====================================
const addToCart = async (req, res) => {

    try {

        const user = req.user;

        if (user.role !== "user") {

            return createResponse(
                res,
                403,
                "You cannot access this resource",
                null,
                false
            );

        }

        const { priceId, shopId, quantity } = req.body;

        if (!priceId || !shopId || !quantity) {

            return createResponse(
                res,
                400,
                "priceId, shopId and quantity are required",
                null,
                false
            );

        }

        const price = await Price.findById(priceId);

        if (!price) {

            return createResponse(
                res,
                404,
                "Price not found",
                null,
                false
            );

        }

        const shop = await Shop.findById(shopId);

        if (!shop) {

            return createResponse(
                res,
                404,
                "Shop not found",
                null,
                false
            );

        }

        let cart = await Cart.findOne({ user: user.id });

        // Create cart if not exists
        if (!cart) {

            cart = await Cart.create({
                user: user.id,
                service: []
            });

        }

        // Check if same price from same shop already exists
        const existingItem = cart.service.find(
            item =>
                item.price.toString() === priceId &&
                item.shop.toString() === shopId
        );

        if (existingItem) {

            existingItem.quantity += Number(quantity);

        }
        else {

            cart.service.push({
                price: priceId,
                shop: shopId,
                quantity
            });

        }

        await cart.save();

        const updatedCart = await Cart.findById(cart._id)
            .populate("service.price")
            .populate("service.shop");

        return createResponse(
            res,
            200,
            "Item Added To Cart",
            updatedCart,
            true
        );

    }
    catch (err) {

        return createResponse(
            res,
            500,
            err.message,
            null,
            false
        );

    }

};




// =====================================
// EDIT CART ITEM
// =====================================
const editCart = async (req, res) => {

    try {

        const user = req.user;

        if (user.role !== "user") {

            return createResponse(
                res,
                403,
                "You cannot access this resource",
                null,
                false
            );

        }

        const { priceId, shopId, quantity } = req.body;

        if (!priceId || !shopId || quantity == null) {

            return createResponse(
                res,
                400,
                "priceId, shopId and quantity are required",
                null,
                false
            );

        }

        const cart = await Cart.findOne({ user: user.id });

        if (!cart) {

            return createResponse(
                res,
                404,
                "Cart not found",
                null,
                false
            );

        }

        const item = cart.service.find(
            item =>
                item.price.toString() === priceId &&
                item.shop.toString() === shopId
        );

        if (!item) {

            return createResponse(
                res,
                404,
                "Item not found in cart",
                null,
                false
            );

        }

        item.quantity = Number(quantity);

        await cart.save();

        const updatedCart = await Cart.findById(cart._id)
            .populate("service.price")
            .populate("service.shop");

        return createResponse(
            res,
            200,
            "Cart Updated Successfully",
            updatedCart,
            true
        );

    }
    catch (err) {

        return createResponse(
            res,
            500,
            err.message,
            null,
            false
        );

    }

};




// =====================================
// DELETE ITEM FROM CART
// =====================================
const deleteCartItem = async (req, res) => {

    try {

        const user = req.user;

        if (user.role !== "user") {

            return createResponse(
                res,
                403,
                "You cannot access this resource",
                null,
                false
            );

        }

        const { priceId, shopId } = req.body;

        if (!priceId || !shopId) {

            return createResponse(
                res,
                400,
                "priceId and shopId are required",
                null,
                false
            );

        }

        const cart = await Cart.findOne({ user: user.id });

        if (!cart) {

            return createResponse(
                res,
                404,
                "Cart not found",
                null,
                false
            );

        }

        cart.service = cart.service.filter(
            item =>
                !(
                    item.price.toString() === priceId &&
                    item.shop.toString() === shopId
                )
        );

        await cart.save();

        const updatedCart = await Cart.findById(cart._id)
            .populate("service.price")
            .populate("service.shop");

        return createResponse(
            res,
            200,
            "Item Removed From Cart",
            updatedCart,
            true
        );

    }
    catch (err) {

        return createResponse(
            res,
            500,
            err.message,
            null,
            false
        );

    }

};




// =====================================
// GET ALL CART ITEMS
// =====================================
const getCart = async (req, res) => {

    try {

        const user = req.user;

        if (user.role !== "user") {

            return createResponse(
                res,
                403,
                "You cannot access this resource",
                null,
                false
            );

        }

        const cart = await Cart.findOne({ user: user.id })
            .populate("service.price")
            .populate("service.shop");

        if (!cart) {

            return createResponse(
                res,
                200,
                "Cart is Empty",
                [],
                true
            );

        }

        return createResponse(
            res,
            200,
            "Fetched Cart Successfully",
            cart,
            true
        );

    }
    catch (err) {

        return createResponse(
            res,
            500,
            err.message,
            null,
            false
        );

    }

};




module.exports = {
    addToCart,
    editCart,
    deleteCartItem,
    getCart
};