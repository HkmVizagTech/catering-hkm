const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
    {
        menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        name: { type: String, required: true },
        qty: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const quoteSchema = new mongoose.Schema(
    {
        quoteNumber: {
            type: String,
            unique: true,
            trim: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Customer is required'],
        },
        eventName: {
            type: String,
            trim: true,
            default: '',
        },
        eventDate: {
            type: Date,
        },
        venue: {
            type: String,
            trim: true,
            default: '',
        },
        pax: {
            type: Number,
            min: 1,
            default: 1,
        },
        lineItems: [lineItemSchema],
        subTotal: { type: Number, default: 0 },
        taxRate: { type: Number, default: 18 },
        taxAmount: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        validUntil: {
            type: Date,
        },
        status: {
            type: String,
            enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Converted'],
            default: 'Draft',
        },
        notes: { type: String, default: '' },
        termsConditions: { type: String, default: '' },
        convertedToOrderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
quoteSchema.index({ customerId: 1 });
quoteSchema.index({ status: 1 });
quoteSchema.index({ eventDate: 1 });

module.exports = mongoose.model('Quote', quoteSchema);
