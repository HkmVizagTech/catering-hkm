const Quote = require('../models/Quote');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const generateNumber = require('../utils/generateNumber');
const { createError } = require('../middleware/errorHandler');

// ── Helper: compute totals from line items ────────────────────────────────────
const computeTotals = (lineItems = [], taxRate = 18, discountAmount = 0) => {
    const subTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = parseFloat(((subTotal - discountAmount) * (taxRate / 100)).toFixed(2));
    const totalAmount = parseFloat((subTotal - discountAmount + taxAmount).toFixed(2));
    return { subTotal, taxAmount, totalAmount };
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all quotes (filterable by status, customerId, date range)
// @route   GET /api/quotes
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getQuotes = async (req, res, next) => {
    try {
        const {
            status,
            customerId,
            fromDate,
            toDate,
            search,
            page = 1,
            limit = 20,
        } = req.query;

        const query = {};

        if (status) query.status = status;
        if (customerId) query.customerId = customerId;

        if (fromDate || toDate) {
            query.eventDate = {};
            if (fromDate) query.eventDate.$gte = new Date(fromDate);
            if (toDate) query.eventDate.$lte = new Date(toDate);
        }

        if (search) {
            query.$or = [
                { quoteNumber: { $regex: search, $options: 'i' } },
                { eventName: { $regex: search, $options: 'i' } },
                { venue: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [quotes, total] = await Promise.all([
            Quote.find(query)
                .populate('customerId', 'name phone email company')
                .populate('createdBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Quote.countDocuments(query),
        ]);

        res.json({
            success: true,
            count: quotes.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: quotes,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new quote
// @route   POST /api/quotes
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createQuote = async (req, res, next) => {
    try {
        const {
            customerId, eventName, eventDate, venue, pax,
            lineItems = [], taxRate = 18, discountAmount = 0,
            validUntil, notes, termsConditions,
        } = req.body;

        if (!customerId) return next(createError(400, 'Customer is required.'));

        // Validate customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) return next(createError(404, 'Customer not found.'));

        // Validate & compute line item totals
        const computedItems = lineItems.map((item) => ({
            menuItemId: item.menuItemId,
            name: item.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
            total: parseFloat((item.qty * item.unitPrice).toFixed(2)),
        }));

        const { subTotal, taxAmount, totalAmount } = computeTotals(computedItems, taxRate, discountAmount);

        const quoteNumber = await generateNumber('QT', Quote);

        const quote = await Quote.create({
            quoteNumber,
            customerId,
            eventName,
            eventDate,
            venue,
            pax,
            lineItems: computedItems,
            subTotal,
            taxRate,
            taxAmount,
            discountAmount,
            totalAmount,
            validUntil,
            notes,
            termsConditions,
            createdBy: req.user.id,
        });

        const populated = await quote.populate('customerId', 'name phone email company');

        res.status(201).json({
            success: true,
            message: `Quote ${quoteNumber} created successfully`,
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single quote by ID
// @route   GET /api/quotes/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getQuoteById = async (req, res, next) => {
    try {
        const quote = await Quote.findById(req.params.id)
            .populate('customerId', 'name phone email company address gstin')
            .populate('createdBy', 'name')
            .populate('convertedToOrderId', 'orderNumber status')
            .lean();

        if (!quote) return next(createError(404, 'Quote not found'));

        res.json({ success: true, data: quote });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a quote
// @route   PUT /api/quotes/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateQuote = async (req, res, next) => {
    try {
        const quote = await Quote.findById(req.params.id);
        if (!quote) return next(createError(404, 'Quote not found'));

        if (quote.status === 'Converted') {
            return next(createError(400, 'Cannot edit a quote that has already been converted to an order.'));
        }

        const allowedFields = [
            'eventName', 'eventDate', 'venue', 'pax', 'lineItems',
            'taxRate', 'discountAmount', 'validUntil', 'status',
            'notes', 'termsConditions', 'customerId',
        ];

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) quote[field] = req.body[field];
        });

        // Recompute totals if line items were updated
        if (req.body.lineItems) {
            quote.lineItems = quote.lineItems.map((item) => ({
                ...item.toObject ? item.toObject() : item,
                total: parseFloat((item.qty * item.unitPrice).toFixed(2)),
            }));
            const { subTotal, taxAmount, totalAmount } = computeTotals(
                quote.lineItems, quote.taxRate, quote.discountAmount
            );
            quote.subTotal = subTotal;
            quote.taxAmount = taxAmount;
            quote.totalAmount = totalAmount;
        }

        await quote.save();

        const populated = await quote.populate('customerId', 'name phone email company');

        res.json({
            success: true,
            message: 'Quote updated successfully',
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a quote (only if Draft)
// @route   DELETE /api/quotes/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteQuote = async (req, res, next) => {
    try {
        const quote = await Quote.findById(req.params.id);
        if (!quote) return next(createError(404, 'Quote not found'));

        if (quote.status !== 'Draft') {
            return next(createError(400, `Only Draft quotes can be deleted. This quote is "${quote.status}".`));
        }

        await quote.deleteOne();

        res.json({
            success: true,
            message: `Quote ${quote.quoteNumber} deleted successfully`,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Convert a quote into an Order
// @route   POST /api/quotes/:id/convert
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const convertQuoteToOrder = async (req, res, next) => {
    try {
        const quote = await Quote.findById(req.params.id);
        if (!quote) return next(createError(404, 'Quote not found'));

        if (quote.status === 'Converted') {
            return next(createError(400, 'This quote has already been converted to an order.'));
        }
        if (quote.status === 'Rejected' || quote.status === 'Expired') {
            return next(createError(400, `Cannot convert a ${quote.status} quote.`));
        }

        const { eventDate, venue, pax } = req.body;

        // Auto-generate order number
        const orderNumber = await generateNumber('ORD', Order);

        const order = await Order.create({
            orderNumber,
            customerId: quote.customerId,
            quoteId: quote._id,
            eventName: quote.eventName,
            eventDate: eventDate || quote.eventDate,
            venue: venue || quote.venue,
            pax: pax || quote.pax,
            lineItems: quote.lineItems,
            subTotal: quote.subTotal,
            taxRate: quote.taxRate,
            taxAmount: quote.taxAmount,
            discountAmount: quote.discountAmount,
            totalAmount: quote.totalAmount,
            amountPaid: 0,
            amountDue: quote.totalAmount,
            status: 'Confirmed',
            notes: quote.notes,
            createdBy: req.user.id,
        });

        // Update quote to Converted and link the order
        quote.status = 'Converted';
        quote.convertedToOrderId = order._id;
        await quote.save();

        // Increment customer totalOrders counter
        await Customer.findByIdAndUpdate(quote.customerId, { $inc: { totalOrders: 1 } });

        const populatedOrder = await order.populate('customerId', 'name phone email company');

        res.status(201).json({
            success: true,
            message: `Quote ${quote.quoteNumber} successfully converted to Order ${orderNumber}`,
            data: {
                order: populatedOrder,
                quote: { _id: quote._id, quoteNumber: quote.quoteNumber, status: quote.status },
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getQuotes,
    createQuote,
    getQuoteById,
    updateQuote,
    deleteQuote,
    convertQuoteToOrder,
};
