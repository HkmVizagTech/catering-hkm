const Order = require('../models/Order');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Dashboard summary — today, tomorrow, future orders + revenue
// @route   GET /api/dashboard/summary
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getDashboardSummary = async (req, res, next) => {
    try {
        // ── Date Boundaries ──────────────────────────────────────────────────
        const now = new Date();

        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const tomorrowStart = new Date(todayEnd);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        tomorrowStart.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setHours(23, 59, 59, 999);

        const futureStart = new Date(tomorrowEnd);
        futureStart.setDate(futureStart.getDate() + 1);
        futureStart.setHours(0, 0, 0, 0);

        // ── Parallel Queries ─────────────────────────────────────────────────
        const activeFilter = { isArchived: false, status: { $nin: ['Cancelled'] } };

        const [
            todayOrders,
            tomorrowOrders,
            futureOrders,
            revenueResult,
            statusBreakdown,
        ] = await Promise.all([
            // Today's orders
            Order.find({
                ...activeFilter,
                eventDate: { $gte: todayStart, $lte: todayEnd },
            })
                .populate('customerId', 'name company')
                .select('orderNumber eventName customerId pax totalAmount amountPaid status paymentStatus venue eventDate')
                .sort({ eventDate: 1 })
                .lean(),

            // Tomorrow's orders
            Order.find({
                ...activeFilter,
                eventDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
            })
                .populate('customerId', 'name company')
                .select('orderNumber eventName customerId pax totalAmount amountPaid status paymentStatus venue eventDate')
                .sort({ eventDate: 1 })
                .lean(),

            // Future orders (day after tomorrow onwards)
            Order.find({
                ...activeFilter,
                eventDate: { $gte: futureStart },
            })
                .populate('customerId', 'name company')
                .select('orderNumber eventName customerId pax totalAmount amountPaid status paymentStatus venue eventDate')
                .sort({ eventDate: 1 })
                .limit(20)
                .lean(),

            // Total revenue (sum of totalAmount of all non-cancelled orders)
            Order.aggregate([
                { $match: { status: { $nin: ['Cancelled'] } } },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$totalAmount' },
                        totalCollected: { $sum: '$amountPaid' },
                        totalPending: { $sum: '$amountDue' },
                    },
                },
            ]),

            // Status count breakdown
            Order.aggregate([
                { $match: { isArchived: false } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);

        // ── Format Revenue ───────────────────────────────────────────────────
        const revenue = revenueResult[0] || {
            totalRevenue: 0,
            totalCollected: 0,
            totalPending: 0,
        };

        // ── Format Status Breakdown ──────────────────────────────────────────
        const statusCounts = {};
        statusBreakdown.forEach(({ _id, count }) => {
            statusCounts[_id] = count;
        });

        res.json({
            success: true,
            data: {
                today: {
                    count: todayOrders.length,
                    orders: todayOrders,
                },
                tomorrow: {
                    count: tomorrowOrders.length,
                    orders: tomorrowOrders,
                },
                future: {
                    count: futureOrders.length,
                    orders: futureOrders,
                },
                revenue: {
                    total: revenue.totalRevenue,
                    collected: revenue.totalCollected,
                    pending: revenue.totalPending,
                },
                statusBreakdown: statusCounts,
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Quick stats (order counts by status, revenue today)
// @route   GET /api/dashboard/stats
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const todayEnd = new Date(now.setHours(23, 59, 59, 999));

        const [totalOrders, activeOrders, todayRevenue, overdueOrders] = await Promise.all([
            Order.countDocuments({ isArchived: false }),
            Order.countDocuments({ isArchived: false, status: { $in: ['Confirmed', 'In-Preparation'] } }),
            Order.aggregate([
                { $match: { eventDate: { $gte: todayStart, $lte: todayEnd } } },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' } } },
            ]),
            Order.countDocuments({ paymentStatus: { $ne: 'Paid' }, isArchived: true }),
        ]);

        res.json({
            success: true,
            data: {
                totalOrders,
                activeOrders,
                todayRevenue: todayRevenue[0]?.revenue || 0,
                overdueOrders,
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { getDashboardSummary, getDashboardStats };
