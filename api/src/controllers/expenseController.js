const Expense = require('../models/Expense');
const generateNumber = require('../utils/generateNumber');
const { createError } = require('../middleware/errorHandler');

// ── GET ALL EXPENSES ─────────────────────────────────────────────────────────
const getExpenses = async (req, res, next) => {
    try {
        const { search, category, status, fromDate, toDate, page = 1, limit = 20 } = req.query;

        const query = {};

        if (category) query.category = category;
        if (status) query.status = status;

        if (fromDate || toDate) {
            query.date = {};
            if (fromDate) query.date.$gte = new Date(fromDate);
            if (toDate) query.date.$lte = new Date(toDate);
        }

        if (search) {
            query.$or = [
                { vendor: { $regex: search, $options: 'i' } },
                { expenseNumber: { $regex: search, $options: 'i' } },
                { reference: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [expenses, total] = await Promise.all([
            Expense.find(query)
                .populate('createdBy', 'name')
                .sort({ date: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Expense.countDocuments(query)
        ]);

        res.json({
            success: true,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: expenses
        });
    } catch (err) {
        next(err);
    }
};

// ── CREATE EXPENSE ──────────────────────────────────────────────────────────
const createExpense = async (req, res, next) => {
    try {
        const { vendor, category, amount, date, status, reference, notes } = req.body;

        const expenseNumber = await generateNumber('EXP', Expense);

        const expense = await Expense.create({
            expenseNumber,
            vendor,
            category,
            amount,
            date: date || new Date(),
            status: status || 'Pending',
            reference,
            notes,
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: `Expense ${expenseNumber} created successfully`,
            data: expense
        });
    } catch (err) {
        next(err);
    }
};

// ── UPDATE EXPENSE ──────────────────────────────────────────────────────────
const updateExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id);
        if (!expense) return next(createError(404, 'Expense not found'));

        const allowedFields = ['vendor', 'category', 'amount', 'date', 'status', 'reference', 'notes'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) expense[field] = req.body[field];
        });

        await expense.save();

        res.json({
            success: true,
            message: 'Expense updated successfully',
            data: expense
        });
    } catch (err) {
        next(err);
    }
};

// ── DELETE EXPENSE ──────────────────────────────────────────────────────────
const deleteExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findByIdAndDelete(req.params.id);
        if (!expense) return next(createError(404, 'Expense not found'));

        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (err) {
        next(err);
    }
};

// ── GET EXPENSE SUMMARY ──────────────────────────────────────────────────────
const getExpenseSummary = async (req, res, next) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const currentMonthTotal = await Expense.aggregate([
            { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const unpaidBills = await Expense.aggregate([
            { $match: { status: 'Pending' } },
            { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
        ]);

        const categoryBreakdown = await Expense.aggregate([
            { $group: { _id: "$category", total: { $sum: "$amount" } } }
        ]);

        res.json({
            success: true,
            data: {
                totalCurrentMonth: currentMonthTotal[0]?.total || 0,
                unpaidTotal: unpaidBills[0]?.total || 0,
                unpaidCount: unpaidBills[0]?.count || 0,
                categoryBreakdown: categoryBreakdown.reduce((acc, curr) => {
                    acc[curr._id] = curr.total;
                    return acc;
                }, {})
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getExpenses,
    createExpense,
    updateExpense,
    deleteExpense,
    getExpenseSummary
};
