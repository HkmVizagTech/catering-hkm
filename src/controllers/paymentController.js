const { razorpay } = require('../config/razorpay');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const generateNumber = require('../utils/generateNumber');
const { createError } = require('../middleware/errorHandler');

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
        const { orderId, invoiceId, customerId, amount } = req.body;

        if (!amount || amount < 1) {
            return next(createError(400, 'Invalid amount'));
        }

        // Validate the catering order exists
        const cateringOrder = await Order.findById(orderId);
        if (!cateringOrder) return next(createError(404, 'Order not found'));

        const options = {
            amount: amount * 100,          // Razorpay expects paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1,
            notes: {
                orderId:    orderId?.toString(),
                invoiceId:  invoiceId?.toString() || '',
                customerId: customerId?.toString() || '',
            },
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return res.status(200).json({
            success: true,
            orderId:        razorpayOrder.id,
            amount:         razorpayOrder.amount,
            currency:       razorpayOrder.currency,
            key:            process.env.RAZORPAY_KEY_ID,
            cateringOrderId: orderId,
            invoiceId,
        });
    } catch (error) {
        console.error('Razorpay create order error:', error);
        return next(createError(500, 'Razorpay order creation failed'));
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
            method,
            reference: reference || '',
            gateway: 'Manual',
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

module.exports = {
    createRazorpayOrder,
    recordPayment,
    getPayments,
    getPaymentSummary,
    reconcilePayment,
    exportPayments,
};
