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

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            trim: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Customer is required'],
        },
        quoteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Quote',
            default: null,
        },
        eventName: {
            type: String,
            trim: true,
            default: '',
        },
        eventDate: {
            type: Date,
        },
        deliveryDate: {
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
        department: {
            type: String,
            trim: true,
            default: '',
        },
        lineItems: [lineItemSchema],
        subTotal: { type: Number, default: 0 },
        taxRate: { type: Number, default: 18 },
        taxAmount: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, default: 0 },
        amountPaid: { type: Number, default: 0 },
        amountDue: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['Draft', 'Confirmed', 'In-Preparation', 'Ready', 'Dispatched', 'Delivered', 'Cancelled'],
            default: 'Draft',
        },
        paymentStatus: {
            type: String,
            enum: ['Unpaid', 'Partially Paid', 'Paid'],
            default: 'Unpaid',
        },
        kitchenStatus: {
            type: String,
            enum: ['Pending', 'In-Progress', 'Ready'],
            default: 'Pending',
        },
        notes: { type: String, default: '' },
        isArchived: { type: Boolean, default: false },
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
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customerId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ eventDate: 1 });
orderSchema.index({ isArchived: 1 });

module.exports = mongoose.model('Order', orderSchema);
