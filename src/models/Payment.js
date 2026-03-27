const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        transactionId: {
            type: String,
            unique: true,
            trim: true,
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: [true, 'Order reference is required'],
        },
        invoiceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invoice',
            default: null,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Customer reference is required'],
        },
        date: {
            type: Date,
            default: Date.now,
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Amount must be at least 1'],
        },
        method: {
            type: String,
            enum: ['UPI', 'GPay', 'PhonePe', 'Cash', 'Card', 'Bank Transfer', 'Cheque', 'Razorpay'],
            required: [true, 'Payment method is required'],
        },
        reference: {
            type: String,
            trim: true,
            default: '',   // UTR number / TXN ref from payer
        },
        gateway: {
            type: String,
            enum: ['Razorpay', 'Manual'],
            default: 'Manual',
        },
        // ── Razorpay specific fields ───────────────────────────────────────
        razorpayOrderId:   { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        // ── Status ────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ['Pending', 'Completed', 'Failed', 'Refunded', 'Reconciled'],
            default: 'Completed',
        },
        isReconciled: { type: Boolean, default: false },
        notes:         { type: String, default: '' },
        recordedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ date: -1 });
paymentSchema.index({ razorpayPaymentId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
