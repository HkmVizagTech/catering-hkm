const { initRazorpay } = require('../config/razorpay');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const crypto = require('crypto');
const generateNumber = require('../utils/generateNumber');
const { createError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { sendWhatsAppTemplate } = require('../services/wapiService');
const { sendWhatsAppMessage } = require('../services/whatsappService');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — update Invoice + Order when payment is recorded
// ─────────────────────────────────────────────────────────────────────────────
const syncPaymentToInvoiceAndOrder = async (invoiceId, orderId, amount) => {
    // Update Invoice
    if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice) {
            invoice.amountPaid = parseFloat((invoice.amountPaid + amount).toFixed(2));
            invoice.balance    = parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2));
            if (invoice.balance <= 0) {
                invoice.status = 'Paid';
                invoice.balance = 0;
            } else {
                invoice.status = 'Partially Paid';
            }
            await invoice.save();
        }
    }

    // Update Order
    if (orderId) {
        const order = await Order.findById(orderId);
        if (order) {
            order.amountPaid = parseFloat((order.amountPaid + amount).toFixed(2));
            order.amountDue  = parseFloat((order.totalAmount - order.amountPaid).toFixed(2));
            if (order.amountDue <= 0) {
                order.paymentStatus = 'Paid';
                order.amountDue = 0;
            } else if (order.amountPaid > 0) {
                order.paymentStatus = 'Partially Paid';
            }
            await order.save();
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a Razorpay order (for online payment)
// @route   POST /api/payments/razorpay/create-order
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createRazorpayOrder = async (req, res, next) => {
    try {
        const { orderId, amount } = req.body;
        
        logger.info(`[Razorpay] Creating order for Catering Order: ${orderId}, Amount: ${amount}`);

        // Sanitize & Validate Amount
        const cleanAmount = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.]/g, ''));
        if (isNaN(cleanAmount) || cleanAmount <= 0) {
            return next(createError(400, 'Invalid payment amount specified'));
        }

        const options = {
            amount: Math.round(cleanAmount * 100), // convert to paise
            currency: 'INR',
            receipt: `rcpt_${orderId?.toString().slice(-10)}_${Date.now().toString().slice(-6)}`,
            notes: {
                cateringOrderId: orderId || 'N/A'
            }
        };

        const razorpayInstance = initRazorpay();
        if (!razorpayInstance) {
            return next(createError(500, 'Razorpay configuration error - check server logs'));
        }

        const razorpayOrder = await razorpayInstance.orders.create(options);
        
        logger.info(`[Razorpay] Order ${razorpayOrder.id} created for catering order ${orderId}`);

        return res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            data: razorpayOrder,
        });
    } catch (err) {
        const errorDesc = (err.error && err.error.description) || (err.error && err.error.message) || err.message || 'unknown error';
        logger.error(`Razorpay Error: ${errorDesc}`, { error: err });
        next(createError(500, `Razorpay error: ${errorDesc}`));
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Record a manual payment (UPI / Cash / Cheque etc.)
// @route   POST /api/payments
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const recordPayment = async (req, res, next) => {
    try {
        const {
            orderId, invoiceId,
            amount, method, reference, date, notes,
            razorpayOrderId, razorpayPaymentId
        } = req.body;

        if (!amount || amount < 1) return next(createError(400, 'Invalid amount'));

        // Validate customer & order
        const order    = await Order.findById(orderId);
        if (!order)    return next(createError(404, 'Order not found'));

        // Derive customer from order
        const customerId = order.customerId;
        const customer = await Customer.findById(customerId);
        if (!customer) return next(createError(404, 'Customer not found in Order'));

        // Auto-generate transaction ID
        const transactionId = await generateNumber('TXN', Payment, 'transactionId');

        const payment = await Payment.create({
            transactionId,
            orderId,
            invoiceId: invoiceId || null,
            customerId,
            amount,
            method: method || 'Card',
            reference: reference || '',
            razorpayOrderId: razorpayOrderId || null,
            razorpayPaymentId: razorpayPaymentId || null,
            gateway: razorpayPaymentId ? 'Razorpay' : 'Manual',
            status: 'Completed',
            date: date ? new Date(date) : new Date(),
            notes: notes || '',
            recordedBy: req.user._id,
        });

        // Sync amountPaid → Invoice + Order
        await syncPaymentToInvoiceAndOrder(invoiceId, orderId, amount);

        // Update customer outstanding balance
        await Customer.findByIdAndUpdate(customerId, {
            $inc: { outstandingBalance: -amount },
        });

        const populated = await payment.populate([
            { path: 'orderId',    select: 'orderNumber eventName' },
            { path: 'invoiceId',  select: 'invoiceNumber' },
            { path: 'customerId', select: 'name company' },
        ]);

        // 7. 🔥 WhatsApp Notification for Payment Success
        // (Removed as user specifically requested only 4 strict templates right now)
        try {
            logger.info(`Payment recorded for ${populated.orderId?.orderNumber}`);
        } catch (err) {
            logger.error(`[Payment WhatsApp] Failed: ${err.message}`);
        }

        res.status(201).json({
            success: true,
            message: `Payment of ₹${amount} recorded as ${transactionId}`,
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all payments (with filters)
// @route   GET /api/payments
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getPayments = async (req, res, next) => {
    try {
        const {
            search = '', status, method,
            customerId, orderId,
            fromDate, toDate,
            isReconciled,
            page = 1, limit = 20,
        } = req.query;

        const query = {};
        if (status)       query.status = status;
        if (method)       query.method = method;
        if (customerId)   query.customerId = customerId;
        if (orderId)      query.orderId = orderId;
        if (isReconciled !== undefined) query.isReconciled = isReconciled === 'true';

        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate)   query.date.$lte = new Date(toDate);
        }

        if (search) {
            query.$or = [
                { transactionId:    { $regex: search, $options: 'i' } },
                { reference:        { $regex: search, $options: 'i' } },
                { razorpayPaymentId:{ $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .populate('orderId',    'orderNumber eventName')
                .populate('invoiceId',  'invoiceNumber')
                .populate('customerId', 'name company phone')
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Payment.countDocuments(query),
        ]);

        res.json({
            success: true,
            count: payments.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: payments,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Payment summary — totals for dashboard cards
// @route   GET /api/payments/summary
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getPaymentSummary = async (req, res, next) => {
    try {
        const [totals, methodBreakdown, pendingReconciliation] = await Promise.all([
            Payment.aggregate([
                { $match: { status: 'Completed' } },
                {
                    $group: {
                        _id: null,
                        totalCollected: { $sum: '$amount' },
                    },
                },
            ]),
            Payment.aggregate([
                { $match: { status: 'Completed' } },
                {
                    $group: {
                        _id:   '$method',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Payment.aggregate([
                { $match: { status: 'Completed', isReconciled: false } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
        ]);

        // Build method map
        const methodMap = {};
        methodBreakdown.forEach(({ _id, total, count }) => {
            methodMap[_id] = { total, count };
        });

        res.json({
            success: true,
            data: {
                totalCollected:       totals[0]?.totalCollected || 0,
                upiTotal:             (methodMap['UPI']?.total || 0) + (methodMap['GPay']?.total || 0) + (methodMap['PhonePe']?.total || 0),
                pendingReconciliation: pendingReconciliation[0]?.total || 0,
                pendingCount:          pendingReconciliation[0]?.count || 0,
                methodBreakdown:      methodMap,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle reconciliation status
// @route   PATCH /api/payments/:id/reconcile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const reconcilePayment = async (req, res, next) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) return next(createError(404, 'Payment not found'));

        payment.isReconciled = !payment.isReconciled;
        if (payment.isReconciled) payment.status = 'Reconciled';
        await payment.save();

        res.json({
            success: true,
            message: `Payment ${payment.isReconciled ? 'reconciled' : 'unreconciled'} successfully`,
            data: payment,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Export payments as flat JSON (CSV-ready)
// @route   GET /api/payments/export
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const exportPayments = async (req, res, next) => {
    try {
        const { fromDate, toDate, method, status } = req.query;
        const query = {};
        if (method) query.method = method;
        if (status) query.status = status;
        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate)   query.date.$lte = new Date(toDate);
        }

        const payments = await Payment.find(query)
            .populate('orderId',    'orderNumber eventName')
            .populate('invoiceId',  'invoiceNumber')
            .populate('customerId', 'name company')
            .lean();

        const rows = payments.map((p) => ({
            transactionId:     p.transactionId,
            date:              new Date(p.date).toISOString().split('T')[0],
            orderRef:          p.orderId?.orderNumber || '',
            customer:          p.customerId?.name || '',
            invoiceNumber:     p.invoiceId?.invoiceNumber || '',
            method:            p.method,
            reference:         p.reference,
            razorpayPaymentId: p.razorpayPaymentId || '',
            amount:            p.amount,
            status:            p.status,
            isReconciled:      p.isReconciled,
        }));

        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Verify Razorpay payment signature
// @route   POST /api/payments/verify
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const verifyPayment = async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId,
            amount,
            invoiceId
        } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return next(createError(400, 'Missing Razorpay payment details'));
        }

        // 1. Verify Signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            logger.error('[Razorpay] Signature verification failed');
            return next(createError(400, 'Invalid payment signature - verification failed'));
        }

        logger.info(`[Razorpay] Payment verified: ${razorpay_payment_id} for Order: ${orderId}`);

        // 2. Double check if this payment was already recorded (prevent duplicates)
        const existing = await Payment.findOne({ razorpayPaymentId: razorpay_payment_id });
        if (existing) {
            return res.json({ success: true, message: 'Payment already recorded', data: existing });
        }

        // 3. Record the payment
        const order = await Order.findById(orderId);
        if (!order) return next(createError(404, 'Order not found'));

        const transactionId = await generateNumber('TXN', Payment, 'transactionId');
        
        const payment = await Payment.create({
            transactionId,
            orderId,
            invoiceId: invoiceId || null,
            customerId: order.customerId,
            amount: parseFloat(amount),
            method: 'Online',
            reference: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            gateway: 'Razorpay',
            status: 'Completed',
            date: new Date(),
            notes: 'Verified online payment via Razorpay',
            recordedBy: req.user._id,
        });

        // 4. Sync totals
        await syncPaymentToInvoiceAndOrder(invoiceId, orderId, amount);

        // 5. Update customer balance
        await Customer.findByIdAndUpdate(order.customerId, {
            $inc: { outstandingBalance: -amount },
        });

        // 6. 🔥 WhatsApp Notification for Online Payment Success
        // (Removed as user specifically requested only 4 strict templates right now)
        try {
            logger.info('Online payment verified successfully');
        } catch (err) {
            logger.error(`[Online Payment WhatsApp] Failed: ${err.message}`);
        }

        res.json({
            success: true,
            message: 'Payment verified and recorded successfully',
            data: payment
        });

    } catch (err) {
        logger.error(`[Razorpay Verify] Error: ${err.message}`);
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a Razorpay payment link
// @route   POST /api/payments/create-link
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createPaymentLink = async (req, res, next) => {
    try {
        const { orderId } = req.body;
        
        const order = await Order.findById(orderId).populate('customerId');
        if (!order) return next(createError(404, 'Order not found'));

        const razorpayInstance = initRazorpay();
        if (!razorpayInstance) return next(createError(500, 'Razorpay configuration error'));

        const expireDate = Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000); // 24 hours from now in seconds

        const paymentLinkRequest = {
            amount: Math.round(order.amountDue * 100), // paise
            currency: "INR",
            accept_partial: false,
            expire_by: expireDate,
            reference_id: `${order.orderNumber}_${Date.now()}`,
            description: `Payment for Order #${order.orderNumber} - ${order.eventName}`,
            customer: {
                name: order.customerId.name,
                email: order.customerId.email || 'catering@hkmvizag.org',
                contact: order.customerId.phone
            },
            notify: {
                sms: true,
                email: true
            },
            reminder_enable: true,
            notes: {
                order_id: orderId
            },
            callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-details/${orderId}`,
            callback_method: "get"
        };

        const paymentLink = await razorpayInstance.paymentLink.create(paymentLinkRequest);

        // Save payment link to order
        order.paymentLinkId = paymentLink.id;
        order.paymentLinkUrl = paymentLink.short_url;
        order.paymentLinkExpiresAt = new Date(expireDate * 1000);
        await order.save();

        // 🔥 TRIGGER WHATSAPP PAYMENT LINK
        let waResult = { success: false, error: 'Not attempted' };
        try {

            const variables = [order.customerId.name, order.orderNumber, order.amountDue, paymentLink.short_url];
            
            waResult = await sendWhatsAppTemplate(order.customerId.phone, 'payment_link', variables);
            if (!waResult.success) {
                logger.error(`[Payment Link WhatsApp] Failed: ${waResult.error}`);
            }
        } catch (err) {
            logger.error(`[Payment Link WhatsApp] Exception: ${err.message}`);
            waResult = { success: false, error: err.message };
        }

        res.json({
            success: true,
            whatsappSent: waResult.success,
            whatsappError: waResult.success ? undefined : waResult.error,
            message: waResult.success 
                ? 'Payment link created and sent via WhatsApp successfully'
                : `Payment link created but WhatsApp failed: ${waResult.error}`,
            data: {
                link: paymentLink.short_url,
                id: paymentLink.id,
                expiresAt: order.paymentLinkExpiresAt
            }
        });

    } catch (err) {
        const errorDesc = (err.error && err.error.description) || err.message || 'Unknown Payment Provider Error';
        logger.error(`Razorpay Payment Link Error: ${errorDesc}`);
        next(createError(500, `Razorpay error: ${errorDesc}`));
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Share existing Razorpay payment link via WhatsApp
// @route   POST /api/payments/:id/whatsapp-link
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const sharePaymentLinkWhatsApp = async (req, res, next) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id).populate('customerId');
        if (!order) return next(createError(404, 'Order not found'));

        if (!order.paymentLinkUrl) {
            return next(createError(400, 'No payment link found for this order. Please generate one first.'));
        }

        const variables = [order.customerId.name, order.orderNumber, order.amountDue, order.paymentLinkUrl];
        const response = await sendWhatsAppTemplate(order.customerId.phone, 'payment_link', variables);

        if (!response?.success) {
            return res.status(500).json({ success: false, message: response?.error || 'WhatsApp sending failed', error: response?.error });
        }

        res.json({ success: true, message: 'Payment link shared successfully via WhatsApp' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createRazorpayOrder,
    createPaymentLink,
    verifyPayment,
    recordPayment,
    getPayments,
    getPaymentSummary,
    reconcilePayment,
    exportPayments,
    sharePaymentLinkWhatsApp,
};

