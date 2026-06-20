const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Payment = require('../models/Payment');

// ── GET FINANCIAL SUMMARY ───────────────────────────────────────────────────
const getReportSummary = async (req, res, next) => {
    try {
        const { period = 'month' } = req.query;
        let dateQuery = {};

        const now = new Date();
        if (period === 'month') {
            dateQuery = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1) } };
        } else if (period === 'last_month') {
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            dateQuery = { createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } };
        }

        // 1. Total Income (Sum of all successfully recorded payments)
        const incomeResult = await Payment.aggregate([
            { $match: { status: 'Completed', ...dateQuery } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        // 2. Total Expenses
        const expenseResult = await Expense.aggregate([
            { $match: { status: 'Paid', ...dateQuery } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        const totalIncome = incomeResult[0]?.total || 0;
        const totalExpenses = expenseResult[0]?.total || 0;
        const netProfit = totalIncome - totalExpenses;
        const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                totalIncome,
                incomeChange: "+15%", // Mocked comparison for UI parity
                totalExpenses,
                expenseChange: "+5%",  // Mocked comparison for UI parity
                netProfit,
                profitMargin
            }
        });
    } catch (err) {
        next(err);
    }
};

// ── GET ACCOUNT BALANCES ─────────────────────────────────────────────────────
const getAccountBalances = async (req, res, next) => {
    try {
        // Receivable: Pending/Partial Invoice balances
        const receivable = await Invoice.aggregate([
            { $match: { status: { $in: ['Pending', 'Partial'] } } },
            { 
              $group: { 
                _id: null, 
                total: { $sum: "$balance" },
                current: { $sum: { $cond: [{ $gte: ["$dueDate", new Date()] }, "$balance", 0] } },
                overdue: { $sum: { $cond: [{ $lt: ["$dueDate", new Date()] }, "$balance", 0] } }
              } 
            }
        ]);

        // Payable: Pending Expense amounts
        const payable = await Expense.aggregate([
            { $match: { status: 'Pending' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        res.json({
            success: true,
            data: {
                receivable: {
                    total: receivable[0]?.total || 0,
                    current: receivable[0]?.current || 0,
                    overdue: receivable[0]?.overdue || 0
                },
                payable: {
                    total: payable[0]?.total || 0,
                    current: (payable[0]?.total || 0) * 0.8, // Mock split for UI
                    overdue: (payable[0]?.total || 0) * 0.2  // Mock split for UI
                }
            }
        });
    } catch (err) {
        next(err);
    }
};

// ── GET GST SUMMARY ──────────────────────────────────────────────────────────
const getGstSummary = async (req, res, next) => {
    try {
        // Output GST (Collected from customers via Invoices)
        // Usually calculated as a percentage of subtotal
        const outputGst = await Invoice.aggregate([
            { $group: { _id: null, total: { $sum: { $multiply: ["$subtotal", 0.05] } } } } // Assuming 5%
        ]);

        // Input Tax Credit (Paid to vendors via Expenses)
        const inputTaxCredit = await Expense.aggregate([
            { $match: { category: { $in: ['Raw Materials', 'Groceries', 'Utilities'] } } },
            { $group: { _id: null, total: { $sum: { $multiply: ["$amount", 0.05] } } } }
        ]);

        const collected = outputGst[0]?.total || 0;
        const itc = inputTaxCredit[0]?.total || 0;

        res.json({
            success: true,
            data: {
                outputGst: collected,
                itc: itc,
                payable: Math.max(0, collected - itc)
            }
        });
    } catch (err) {
        next(err);
    }
};

// ── GET EXPENSE BREAKDOWN ────────────────────────────────────────────────────
const getExpenseBreakdown = async (req, res, next) => {
    try {
        const breakdown = await Expense.aggregate([
            { $group: { _id: "$category", amount: { $sum: "$amount" } } },
            { $sort: { amount: -1 } }
        ]);

        res.json({
            success: true,
            data: breakdown.map(b => ({
                category: b._id,
                amount: b.amount,
                percentage: 0 // Will be calculated on frontend relative to max
            }))
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getReportSummary,
    getAccountBalances,
    getGstSummary,
    getExpenseBreakdown
};
