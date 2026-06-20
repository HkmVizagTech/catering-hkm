const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Quote = require('../models/Quote');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');

// ── GET DASHBOARD STATS ─────────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const nextWeekStart = new Date(tomorrow);
        nextWeekStart.setDate(nextWeekStart.getDate() + 1);
        const nextWeekEnd = new Date(today);
        nextWeekEnd.setDate(nextWeekEnd.getDate() + 8);

        // 1. Today's Orders
        const todayOrders = await Order.find({
            deliveryDate: { $gte: today, $lt: tomorrow },
            isArchived: false
        })
        .populate('customerId', 'name')
        .sort({ deliveryTime: 1 })
        .lean();

        // 1b. Yesterday's Comparison
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayCount = await Order.countDocuments({
            deliveryDate: { $gte: yesterday, $lt: today },
            isArchived: false
        });

        // 2. Pending Collection (Balanced from Unpaid/Partial Invoices)
        const pendingCollectionResult = await Invoice.aggregate([
            { $match: { status: { $in: ['Sent', 'Partially Paid'] } } },
            { $group: { _id: null, total: { $sum: "$balance" } } }
        ]);

        // 3. Active Quotes
        const activeQuotesCount = await Quote.countDocuments({
            status: { $in: ['Draft', 'Sent', 'Pending'] }
        });

        // 4. Total Customers
        const totalCustomers = await Customer.countDocuments();

        // 5. Tomorrow's Prep
        const tomorrowOrders = await Order.find({
            deliveryDate: { $gte: tomorrow, $lt: nextWeekStart },
            isArchived: false
        })
        .populate('customerId', 'name')
        .limit(5)
        .lean();

        // 6. Next Week Forecast
        const nextWeekOrders = await Order.find({
            deliveryDate: { $gte: nextWeekStart, $lt: nextWeekEnd },
            isArchived: false
        })
        .populate('customerId', 'name')
        .sort({ deliveryDate: 1 })
        .limit(5)
        .lean();

        res.json({
            success: true,
            data: {
                summary: {
                    todayOrders: {
                        count: todayOrders.length,
                        change: todayOrders.length - yesterdayCount
                    },
                    pendingCollection: pendingCollectionResult[0]?.total || 0,
                    activeQuotes: activeQuotesCount,
                    totalCustomers: totalCustomers
                },
                todayWorkList: todayOrders.map(o => ({
                    id: o._id,
                    orderNumber: o.orderNumber?.slice(-3) || "000",
                    customerName: o.customerId?.name || "Unknown",
                    itemsCount: (o.lineItems || o.items || []).length,
                    value: o.totalAmount,
                    status: o.status
                })),
                tomorrowPrep: tomorrowOrders.map(o => ({
                    id: o._id,
                    customerName: o.customerId?.name || "Unknown",
                    status: o.status
                })),
                nextWeekForecast: nextWeekOrders.map(o => ({
                    id: o._id,
                    date: o.deliveryDate,
                    orderNumber: o.orderNumber?.slice(-3) || "000",
                    customerName: o.customerId?.name || "Unknown",
                    itemsCount: (o.lineItems || o.items || []).length,
                    value: o.totalAmount,
                    status: o.status
                }))
            }
        });
    } catch (err) {
        next(err);
    }
};

// ── GET FINANCIAL SUMMARY ───────────────────────────────────────────────────
// @route   GET /api/dashboard/financial
// @access  Private
const getFinancialSummary = async (req, res, next) => {
    try {
        // 1. Total Revenue — sum of all Completed payments
        const revenueResult = await Payment.aggregate([
            { $match: { status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 2. Total Orders count (non-archived)
        const totalOrders = await Order.countDocuments({ isArchived: false });

        // 3. Pending Payments — sum of balance on unpaid/partial invoices
        const pendingResult = await Invoice.aggregate([
            { $match: { status: { $in: ['Sent', 'Partially Paid'] } } },
            { $group: { _id: null, total: { $sum: '$balance' } } }
        ]);

        // 4. Total Expenses — sum of all expenses (all time)
        const expenseResult = await Expense.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        // 5. Recent Orders — last 5 non-archived orders
        const recentOrders = await Order.find({ isArchived: false })
            .populate('customerId', 'name company')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // 6. Recent Payments — last 5 completed payments
        const recentPayments = await Payment.find()
            .populate('customerId', 'name company')
            .populate('orderId', 'orderNumber')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        res.json({
            success: true,
            data: {
                summary: {
                    totalRevenue: revenueResult[0]?.total || 0,
                    totalOrders,
                    pendingPayments: pendingResult[0]?.total || 0,
                    totalExpenses: expenseResult[0]?.total || 0,
                },
                recentOrders: recentOrders.map(o => ({
                    id: o._id,
                    orderNumber: o.orderNumber || '—',
                    customerName: (typeof o.customerId === 'object' && o.customerId?.name) ? o.customerId.name : 'Unknown',
                    eventName: o.eventName || '',
                    date: o.createdAt,
                    amount: o.totalAmount || 0,
                    status: o.status,
                    paymentStatus: o.paymentStatus || 'Unpaid',
                })),
                recentPayments: recentPayments.map(p => ({
                    id: p._id,
                    transactionId: p.transactionId || '—',
                    customerName: (typeof p.customerId === 'object' && p.customerId?.name) ? p.customerId.name : 'Unknown',
                    method: p.method || '—',
                    amount: p.amount || 0,
                    status: p.status,
                    date: p.createdAt,
                })),
            }
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboardStats,
    getFinancialSummary
};
