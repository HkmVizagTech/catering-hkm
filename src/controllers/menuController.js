const MenuItem = require('../models/MenuItem');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all menu items (filterable by category, isVeg, isAvailable)
// @route   GET /api/menu
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMenuItems = async (req, res, next) => {
    try {
        const { category, isVeg, isAvailable, search } = req.query;

        const query = {};

        if (category) query.category = category;
        if (isVeg !== undefined) query.isVeg = isVeg === 'true';
        if (isAvailable !== undefined) query.isAvailable = isAvailable !== 'false';

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
            ];
        }

        const items = await MenuItem.find(query)
            .sort({ category: 1, name: 1 })
            .lean();

        // Group by category for easy frontend consumption
        const grouped = items.reduce((acc, item) => {
            if (!acc[item.category]) acc[item.category] = [];
            acc[item.category].push(item);
            return acc;
        }, {});

        res.json({
            success: true,
            count: items.length,
            data: items,
            grouped,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new menu item
// @route   POST /api/menu
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createMenuItem = async (req, res, next) => {
    try {
        const { name, category, price, unit, isVeg, description, tags } = req.body;
        const imageUrl = req.file ? (req.file.linkUrl || req.file.path) : req.body.imageUrl;

        if (!name || !category || price === undefined) {
            return next(createError(400, 'Name, category, and price are required.'));
        }

        const item = await MenuItem.create({
            name,
            category,
            price,
            unit,
            isVeg,
            description,
            imageUrl,
            tags,
        });

        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            data: item,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a menu item
// @route   PUT /api/menu/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateMenuItem = async (req, res, next) => {
    try {
        const allowedFields = ['name', 'category', 'price', 'unit', 'isVeg', 'description', 'tags', 'isAvailable'];

        const updates = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        // Handle image update separately
        if (req.file) {
            updates.imageUrl = req.file.linkUrl || req.file.path;
        } else if (req.body.imageUrl !== undefined) {
            updates.imageUrl = req.body.imageUrl;
        }

        const item = await MenuItem.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!item) return next(createError(404, 'Menu item not found'));

        res.json({
            success: true,
            message: 'Menu item updated successfully',
            data: item,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a menu item
// @route   DELETE /api/menu/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteMenuItem = async (req, res, next) => {
    try {
        const item = await MenuItem.findByIdAndDelete(req.params.id);

        if (!item) return next(createError(404, 'Menu item not found'));

        res.json({
            success: true,
            message: 'Menu item deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle item availability (isAvailable flip)
// @route   PATCH /api/menu/:id/availability
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const toggleAvailability = async (req, res, next) => {
    try {
        const item = await MenuItem.findById(req.params.id);

        if (!item) return next(createError(404, 'Menu item not found'));

        item.isAvailable = !item.isAvailable;
        await item.save();

        res.json({
            success: true,
            message: `"${item.name}" is now ${item.isAvailable ? 'available' : 'unavailable'}`,
            data: item,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
};
