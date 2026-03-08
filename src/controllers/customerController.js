const Customer = require('../models/Customer');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all customers (with search + pagination)
// @route   GET /api/customers
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getCustomers = async (req, res, next) => {
    try {
        const {
            search = '',
            page = 1,
            limit = 20,
            type,
            isActive = 'true',
        } = req.query;

        const query = { isActive: isActive !== 'false' };

        // Full-text search across name, company, email
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { company: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        if (type) query.customerType = type;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [customers, total] = await Promise.all([
            Customer.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Customer.countDocuments(query),
        ]);

        res.json({
            success: true,
            count: customers.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: customers,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const createCustomer = async (req, res, next) => {
    try {
        const { name, company, email, phone, address, gstin, customerType, notes, tags } = req.body;

        // Check for duplicate phone
        const existingPhone = await Customer.findOne({ phone, isActive: true });
        if (existingPhone) {
            return next(createError(409, `A customer with phone ${phone} already exists.`));
        }

        // Check for duplicate email (if provided)
        if (email) {
            const existingEmail = await Customer.findOne({ email, isActive: true });
            if (existingEmail) {
                return next(createError(409, `A customer with email ${email} already exists.`));
            }
        }

        const customer = await Customer.create({
            name,
            company,
            email,
            phone,
            address,
            gstin,
            customerType,
            notes,
            tags,
        });

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: customer,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single customer by ID (with recent orders)
// @route   GET /api/customers/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerById = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id).lean();

        if (!customer) {
            return next(createError(404, 'Customer not found'));
        }

        // Fetch recent orders for this customer (lazy import to avoid circular deps)
        let recentOrders = [];
        try {
            const Order = require('../models/Order');
            recentOrders = await Order.find({ customerId: req.params.id })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('orderNumber eventName eventDate totalAmount status paymentStatus')
                .lean();
        } catch {
            // Order model may not exist yet during early development
        }

        res.json({
            success: true,
            data: { ...customer, recentOrders },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update a customer
// @route   PUT /api/customers/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateCustomer = async (req, res, next) => {
    try {
        const allowedFields = [
            'name', 'company', 'email', 'phone', 'address',
            'gstin', 'customerType', 'notes', 'tags',
        ];

        const updates = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) updates[field] = req.body[field];
        });

        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!customer) {
            return next(createError(404, 'Customer not found'));
        }

        res.json({
            success: true,
            message: 'Customer updated successfully',
            data: customer,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Soft-delete a customer (sets isActive: false)
// @route   DELETE /api/customers/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: false } },
            { new: true }
        );

        if (!customer) {
            return next(createError(404, 'Customer not found'));
        }

        res.json({
            success: true,
            message: 'Customer deactivated successfully',
            data: customer,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
};
