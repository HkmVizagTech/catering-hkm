const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Item name is required'],
            trim: true,
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            enum: {
                values: ['Main Course', 'Breads', 'Rice', 'Desserts', 'Sides', 'Starters', 'Beverages'],
                message: '{VALUE} is not a valid category',
            },
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative'],
        },
        unit: {
            type: String,
            default: 'per plate',
            trim: true,
        },
        isVeg: {
            type: Boolean,
            default: true,
        },
        description: {
            type: String,
            default: '',
            trim: true,
        },
        imageUrl: {
            type: String,
            default: '',
        },
        isAvailable: {
            type: Boolean,
            default: true,
        },
        tags: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// ── Indexes 
menuItemSchema.index({ name: 'text', description: 'text' });
menuItemSchema.index({ category: 1 });
menuItemSchema.index({ isVeg: 1 });
menuItemSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
