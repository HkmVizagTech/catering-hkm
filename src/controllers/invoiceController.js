const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const generateNumber = require('../utils/generateNumber');
const { generateInvoicePDF } = require('../services/pdfService');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all invoices (with filters)
// @route   GET /api/invoices
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getInvoices = async (req, res, next) => {
    try {
        const {
            search = '',
            status,
            customerId,
            fromDate,
            toDate,
            page = 1,
            limit = 20,
        } = req.query;

        const query = {};
        if (status)     query.status = status;
        if (customerId) query.customerId = customerId;

        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate)   query.date.$lte = new Date(toDate);
        }

        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [invoices, total] = await Promise.all([
            Invoice.find(query)
                .populate('orderId', 'orderNumber eventName')
                .populate('customerId', 'name company phone email')
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Invoice.countDocuments(query),
        ]);

        res.json({
            success: true,
            count: invoices.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: invoices,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create invoice from an order
// @route   POST /api/invoices
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createInvoice = async (req, res, next) => {
    try {
        const { orderId, dueDate, notes, taxRate, discountAmount } = req.body;

        // Validate order
        const order = await Order.findById(orderId).populate('customerId');
        if (!order) return next(createError(404, 'Order not found'));

        // Check if invoice already exists for this order
        const existing = await Invoice.findOne({ orderId });
        if (existing) {
            return next(createError(409, `Invoice ${existing.invoiceNumber} already exists for this order`));
        }

        // Auto-generate invoice number
        const invoiceNumber = await generateNumber('INV', Invoice);

        // Use order's line items and financials (or override with body)
        const lineItems = order.lineItems.map((item) => ({
            name: item.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
            total: item.total,
        }));

        const tax = taxRate ?? order.taxRate;
        const discount = discountAmount ?? order.discountAmount;
        const subTotal = lineItems.reduce((sum, i) => sum + i.total, 0);
        const taxAmount = parseFloat(((subTotal * tax) / 100).toFixed(2));
        const totalAmount = parseFloat((subTotal + taxAmount - discount).toFixed(2));
        const amountPaid = order.amountPaid || 0;
        const balance = parseFloat((totalAmount - amountPaid).toFixed(2));

        const invoice = await Invoice.create({
            invoiceNumber,
            orderId,
            customerId: order.customerId._id,
            date: new Date(),
            dueDate: dueDate || null,
            lineItems,
            subTotal,
            taxRate: tax,
            taxAmount,
            discountAmount: discount,
            totalAmount,
            amountPaid,
            balance,
            notes: notes || '',
            createdBy: req.user._id,
        });

        const populated = await invoice.populate([
            { path: 'orderId',    select: 'orderNumber eventName venue pax' },
            { path: 'customerId', select: 'name company phone email gstin address' },
        ]);

        res.status(201).json({
            success: true,
            message: `Invoice ${invoiceNumber} created successfully`,
            data: populated,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single invoice by ID
// @route   GET /api/invoices/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getInvoiceById = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('orderId',    'orderNumber eventName venue pax eventDate')
            .populate('customerId', 'name company phone email gstin address')
            .populate('createdBy',  'name email')
            .lean();

        if (!invoice) return next(createError(404, 'Invoice not found'));

        res.json({ success: true, data: invoice });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update invoice (status, notes, dueDate)
// @route   PUT /api/invoices/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateInvoice = async (req, res, next) => {
    try {
        const { status, notes, dueDate, amountPaid } = req.body;

        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return next(createError(404, 'Invoice not found'));

        if (status)    invoice.status = status;
        if (notes)     invoice.notes = notes;
        if (dueDate)   invoice.dueDate = new Date(dueDate);

        // If amountPaid is updated, recalculate balance and status
        if (amountPaid !== undefined) {
            invoice.amountPaid = parseFloat(amountPaid);
            invoice.balance    = parseFloat((invoice.totalAmount - amountPaid).toFixed(2));

            if (invoice.balance <= 0) {
                invoice.status = 'Paid';
                invoice.balance = 0;
            } else if (amountPaid > 0) {
                invoice.status = 'Partially Paid';
            }
        }

        await invoice.save();

        // Sync amountPaid back to the Order
        if (amountPaid !== undefined) {
            await Order.findByIdAndUpdate(invoice.orderId, {
                $set: {
                    amountPaid: invoice.amountPaid,
                    amountDue:  invoice.balance,
                    paymentStatus: invoice.status === 'Paid' ? 'Paid'
                        : amountPaid > 0 ? 'Partially Paid' : 'Unpaid',
                },
            });
        }

        res.json({ success: true, message: 'Invoice updated successfully', data: invoice });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Download invoice as PDF
// @route   GET /api/invoices/:id/pdf
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const downloadInvoicePDF = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('orderId',    'orderNumber eventName')
            .populate('customerId', 'name company phone email gstin address');

        if (!invoice) return next(createError(404, 'Invoice not found'));

        const customer = invoice.customerId;
        const pdfBuffer = await generateInvoicePDF(invoice, customer);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${invoice.invoiceNumber}.pdf"`
        );
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Bulk export invoices (summary list)
// @route   POST /api/invoices/bulk-export
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const bulkExport = async (req, res, next) => {
    try {
        const { ids, status, fromDate, toDate } = req.body;

        const query = {};
        if (ids && ids.length)  query._id = { $in: ids };
        if (status)             query.status = status;
        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate)   query.date.$lte = new Date(toDate);
        }

        const invoices = await Invoice.find(query)
            .populate('orderId',    'orderNumber eventName')
            .populate('customerId', 'name company')
            .lean();

        const rows = invoices.map((inv) => ({
            invoiceNumber: inv.invoiceNumber,
            orderRef:      inv.orderId?.orderNumber || '',
            customer:      inv.customerId?.name || '',
            company:       inv.customerId?.company || '',
            date:          new Date(inv.date).toISOString().split('T')[0],
            totalAmount:   inv.totalAmount,
            amountPaid:    inv.amountPaid,
            balance:       inv.balance,
            status:        inv.status,
        }));

        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Send invoice to customer (e.g. via WhatsApp)
// @route   POST /api/invoices/:id/send
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const sendInvoice = async (req, res, next) => {
    try {
        // TODO: Implement sending invoice using whatsappService or email based on user preference
        res.json({ success: true, message: 'Send invoice feature coming soon!' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getInvoices,
    createInvoice,
    getInvoiceById,
    updateInvoice,
    downloadInvoicePDF,
    bulkExport,
    sendInvoice,
};
