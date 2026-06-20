// controllers/priceCategoryController.js

const { PriceCategory } = require("../../Models/Admin/PriceCategory");


// Add Price Category
const addPriceCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const existingCategory = await PriceCategory.findOne({ name });

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: "Category already exists"
            });
        }

        const category = await PriceCategory.create({ name });

        return res.status(201).json({
            success: true,
            message: "Price category added successfully",
            data: category
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// View All Price Categories
const getAllPriceCategories = async (req, res) => {
    try {

        const categories = await PriceCategory.find().sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Edit Price Category
const editPriceCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const category = await PriceCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Price category not found"
            });
        }

        category.name = name || category.name;

        await category.save();

        return res.status(200).json({
            success: true,
            message: "Price category updated successfully",
            data: category
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Delete Price Category
const deletePriceCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await PriceCategory.findById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Price category not found"
            });
        }

        await PriceCategory.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Price category deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    addPriceCategory,
    getAllPriceCategories,
    editPriceCategory,
    deletePriceCategory
};