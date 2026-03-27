const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Customer name is required'],
            trim: true,
        },
        company: {
            type: String,
            trim: true,
            default: '',
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            sparse: true, 
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            trim: true,
        },
        address: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            pincode: { type: String, default: '' },
        },
        gstin: {
            type: String,
            trim: true,
            uppercase: true,
            default: '',
        },
        customerType: {
            type: String,
            enum: ['individual', 'corporate'],
            default: 'individual',
        },
        notes: {
            type: String,
            default: '',
        },
        tags: {
            type: [String],
            default: [],
        },

        // ── Denormalized Counters (updated on order/payment events) 
        totalOrders: {
            type: Number,
            default: 0,
        },
        outstandingBalance: {
            type: Number,
            default: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true, // adds createdAt, updatedAt
    }
);

// ── Indexes 
customerSchema.index({ name: 'text', company: 'text', email: 'text' });
customerSchema.index({ phone: 1 });
customerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);
