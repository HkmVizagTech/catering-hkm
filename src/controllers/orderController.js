const Order = require('../models/Order');
const Customer = require('../models/Customer');
const generateNumber = require('../utils/generateNumber');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all orders (active/archive, search, filters)
// @route   GET /api/orders
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getOrders = async (req, res, next) => {
    try {
        const {
            search = '',
            status,
            paymentStatus,
            isArchived = 'false',
            page = 1,
            limit = 20,
            fromDate,
            toDate,
        } = req.query;

        const query = { isArchived: isArchived === 'true' };

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        // Date range filter on eventDate
        if (fromDate || toDate) {
            query.eventDate = {};
            if (fromDate) query.eventDate.$gte = new Date(fromDate);
            if (toDate) query.eventDate.$lte = new Date(toDate);
        }

        // Search by orderNumber or eventName
        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { eventName: { $regex: search, $options: 'i' } },
                { venue: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('customerId', 'name company phone email')
                .sort({ eventDate: 1, createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Order.countDocuments(query),
        ]);

        res.json({
            success: true,
            count: orders.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: orders,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createOrder = async (req, res, next) => {
    try {
        const {
            customerId, quoteId, eventName, eventDate, deliveryDate,
            venue, pax, department, lineItems, taxRate,
            discountAmount, notes,
        } = req.body;

        // Validate customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) return next(createError(404, 'Customer not found'));

        // Auto-generate order number
        const orderNumber = await generateNumber('ORD', Order);

        // Calculate financials
        const subTotal = (lineItems || []).reduce((sum, item) => sum + item.total, 0);
        const tax = taxRate ?? 18;
        const taxAmount = parseFloat(((subTotal * tax) / 100).toFixed(2));
        const discount = discountAmount || 0;
        const totalAmount = parseFloat((subTotal + taxAmount - discount).toFixed(2));

        const order = await Order.create({
            orderNumber,
            customerId,
            quoteId: quoteId || null,
            eventName,
            eventDate,
            deliveryDate,
            venue,
            pax,
            department,
            lineItems: lineItems || [],
            subTotal,
            taxRate: tax,
            taxAmount,
            discountAmount: discount,
            totalAmount,
            amountPaid: 0,
            amountDue: totalAmount,
            createdBy: req.user._id,
        });

        // Increment customer order count
        await Customer.findByIdAndUpdate(customerId, { $inc: { totalOrders: 1 } });

        const populated = await order.populate('customerId', 'name company phone email');

        res.status(201).json({
            success: true,
            message: `Order ${orderNumber} created successfully`,
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single order by ID
// @route   GET /api/orders/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getOrderById = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customerId', 'name company phone email gstin address')
            .populate('createdBy', 'name email')
            .lean();

        if (!order) return next(createError(404, 'Order not found'));

        res.json({ success: true, data: order });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update an order
// @route   PUT /api/orders/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateOrder = async (req, res, next) => {
    try {
        const allowedFields = [
            'eventName', 'eventDate', 'deliveryDate', 'venue', 'pax',
            'department', 'lineItems', 'taxRate', 'discountAmount', 'notes',
        ];

        const updates = {};
        allowedFields.forEach((f) => {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        });

        // Recalculate financials if lineItems or taxRate changed
        if (updates.lineItems || updates.taxRate !== undefined) {
            const existingOrder = await Order.findById(req.params.id);
            const lineItems = updates.lineItems || existingOrder.lineItems;
            const taxRate = updates.taxRate !== undefined ? updates.taxRate : existingOrder.taxRate;
            const discount = updates.discountAmount !== undefined ? updates.discountAmount : existingOrder.discountAmount;

            updates.subTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
            updates.taxAmount = parseFloat(((updates.subTotal * taxRate) / 100).toFixed(2));
            updates.discountAmount = discount;
            updates.totalAmount = parseFloat((updates.subTotal + updates.taxAmount - discount).toFixed(2));
            updates.amountDue = parseFloat((updates.totalAmount - (existingOrder.amountPaid || 0)).toFixed(2));
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('customerId', 'name company phone');

        if (!order) return next(createError(404, 'Order not found'));

        res.json({ success: true, message: 'Order updated successfully', data: order });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update order status or kitchen status
// @route   PATCH /api/orders/:id/status
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateOrderStatus = async (req, res, next) => {
    try {
        const { status, kitchenStatus, paymentStatus } = req.body;

        const updates = {};
        if (status) updates.status = status;
        if (kitchenStatus) updates.kitchenStatus = kitchenStatus;
        if (paymentStatus) updates.paymentStatus = paymentStatus;

        // Auto-archive cancelled/delivered orders
        if (status === 'Cancelled' || status === 'Delivered') {
            updates.isArchived = true;
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true }
        ).populate('customerId', 'name company');

        if (!order) return next(createError(404, 'Order not found'));

        res.json({ success: true, message: `Order status updated to "${status || kitchenStatus}"`, data: order });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Archive / Un-archive an order
// @route   PATCH /api/orders/:id/archive
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const archiveOrder = async (req, res, next) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return next(createError(404, 'Order not found'));

        order.isArchived = !order.isArchived;
        await order.save();

        res.json({
            success: true,
            message: `Order ${order.isArchived ? 'archived' : 'restored'} successfully`,
            data: order,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Export orders as JSON (CSV logic would go here)
// @route   GET /api/orders/export
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const exportOrders = async (req, res, next) => {
    try {
        const { status, fromDate, toDate } = req.query;
        const query = {};
        if (status) query.status = status;
        if (fromDate || toDate) {
            query.eventDate = {};
            if (fromDate) query.eventDate.$gte = new Date(fromDate);
            if (toDate) query.eventDate.$lte = new Date(toDate);
        }

        const orders = await Order.find(query)
            .populate('customerId', 'name company phone')
            .lean();

        // Flatten for CSV-friendly structure
        const rows = orders.map((o) => ({
            orderNumber: o.orderNumber,
            customer: o.customerId?.name || '',
            company: o.customerId?.company || '',
            eventName: o.eventName,
            eventDate: o.eventDate ? new Date(o.eventDate).toISOString().split('T')[0] : '',
            venue: o.venue,
            pax: o.pax,
            totalAmount: o.totalAmount,
            amountPaid: o.amountPaid,
            amountDue: o.amountDue,
            status: o.status,
            paymentStatus: o.paymentStatus,
        }));

        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getOrders,
    createOrder,
    getOrderById,
    updateOrder,
    updateOrderStatus,
    archiveOrder,
    exportOrders,
};
