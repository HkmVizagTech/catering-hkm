const mongoose = require('mongoose');

const invoiceLineItemSchema = new mongoose.Schema(
    {
        name:      { type: String, required: true },
        qty:       { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        total:     { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const invoiceSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            trim: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: [true, 'Order reference is required'],
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Customer is required'],
        },
        date: {
            type: Date,
            default: Date.now,
        },
        dueDate: {
            type: Date,
        },
        lineItems: [invoiceLineItemSchema],
        subTotal:       { type: Number, default: 0 },
        taxRate:        { type: Number, default: 18 },
        taxAmount:      { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        totalAmount:    { type: Number, default: 0 },
        amountPaid:     { type: Number, default: 0 },
        balance:        { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['Draft', 'Sent', 'Paid', 'Partially Paid', 'Overdue', 'Cancelled'],
            default: 'Draft',
        },
        pdfUrl:        { type: String, default: null },
        // ── Meta ──────────────────────────────────────────────────────────
        notes:     { type: String, default: '' },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ orderId: 1 });
invoiceSchema.index({ customerId: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ date: -1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
