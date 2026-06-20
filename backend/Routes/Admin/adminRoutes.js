const express = require("express");
const { createResponse } = require("../../utils/Response");

const router = express.Router()
const {
    addPriceCategory,
    getAllPriceCategories,
    editPriceCategory,
    deletePriceCategory
} = require("../../Controllers/Admin/priceCategoryController");


// Add Category
router.post("/category/add", addPriceCategory);

// View All Categories
router.get("/category/all", getAllPriceCategories);

// Edit Category
router.put("/category/edit/:id", editPriceCategory);

// Delete Category
router.delete("/category/delete/:id", deletePriceCategory);

module.exports = router;
