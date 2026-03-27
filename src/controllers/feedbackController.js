const Feedback = require('../models/Feedback');
const Order = require('../models/Order');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Submit new feedback for an order
// @route   POST /api/feedback
// @access  Private (or Public with a secure token in a real app)
// ─────────────────────────────────────────────────────────────────────────────
const submitFeedback = async (req, res, next) => {
    try {
        const { orderId, overallRating, foodQuality, timeliness, service, comment, tags } = req.body;

        if (!orderId || !overallRating || !foodQuality || !timeliness || !service) {
            return next(createError(400, 'Please provide order ID and all rating categories (1-5)'));
        }

        const order = await Order.findById(orderId);
        if (!order) return next(createError(404, 'Order not found'));

        // Prevent double feedback submission
        const existingFeedback = await Feedback.findOne({ orderId });
        if (existingFeedback) {
            return next(createError(400, 'Feedback has already been submitted for this order'));
        }

        const feedback = await Feedback.create({
            orderId,
            customerId: order.customerId,
            overallRating,
            foodQuality,
            timeliness,
            service,
            comment,
            tags: tags || [],
        });

        res.status(201).json({
            success: true,
            message: 'Feedback submitted successfully. Thank you!',
            data: feedback,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all feedback with filters/search
// @route   GET /api/feedback
// @access  Private (Admin / Staff)
// ─────────────────────────────────────────────────────────────────────────────
const getFeedback = async (req, res, next) => {
    try {
        const {
            search = '',
            sentiment, rating, customerId, orderId,
            fromDate, toDate,
            page = 1, limit = 20,
        } = req.query;

        const query = {};

        if (sentiment)  query.sentiment = sentiment;
        if (rating)     query.overallRating = parseInt(rating);
        if (customerId) query.customerId = customerId;
        if (orderId)    query.orderId = orderId;

        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate)   query.createdAt.$lte = new Date(toDate);
        }

        if (search) {
            query.comment = { $regex: search, $options: 'i' };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [feedbacks, total] = await Promise.all([
            Feedback.find(query)
                .populate('customerId', 'name company')
                .populate('orderId', 'orderNumber eventName department')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Feedback.countDocuments(query),
        ]);

        res.json({
            success: true,
            count: feedbacks.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            data: feedbacks,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get feedback summary matrix (averages and sentiment breakdown)
// @route   GET /api/feedback/summary
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getFeedbackSummary = async (req, res, next) => {
    try {
        const { fromDate, toDate, department, customerId } = req.query;

        // Base match object built on Dates/Customer
        const matchStage = {};
        if (customerId) matchStage.customerId = customerId;
        if (fromDate || toDate) {
            matchStage.createdAt = {};
            if (fromDate) matchStage.createdAt.$gte = new Date(fromDate);
            if (toDate)   matchStage.createdAt.$lte = new Date(toDate);
        }

        // Parallel aggregation
        const [averages, sentimentCount, recentCritical] = await Promise.all([
            Feedback.getAverageRatings(matchStage),
            Feedback.aggregate([
                { $match: matchStage },
                { $group: { _id: '$sentiment', count: { $sum: 1 } } }
            ]),
            Feedback.find({ ...matchStage, overallRating: { $lte: 2 } })
                .populate('customerId', 'name phone')
                .populate('orderId', 'orderNumber')
                .sort({ createdAt: -1 })
                .limit(5)
                .lean()
        ]);

        // Format sentiment
        const sentimentMatrix = { Positive: 0, Neutral: 0, Negative: 0 };
        sentimentCount.forEach(s => sentimentMatrix[s._id] = s.count);

        res.json({
            success: true,
            data: {
                averages: averages[0] || {
                    avgOverall: 0, avgFood: 0, avgTimeliness: 0, avgService: 0, count: 0
                },
                sentiments: sentimentMatrix,
                recentCritical, // Top 5 critical feedback items demanding attention
            },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Export feedback to flat structure for Excel/CSV
// @route   GET /api/feedback/export
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const exportFeedback = async (req, res, next) => {
    try {
        const { fromDate, toDate } = req.query;

        const query = {};
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate)   query.createdAt.$lte = new Date(toDate);
        }

        const feedbacks = await Feedback.find(query)
            .populate('customerId', 'name company')
            .populate('orderId', 'orderNumber eventName department')
            .sort({ createdAt: -1 })
            .lean();

        const rows = feedbacks.map((f) => ({
            date:       new Date(f.createdAt).toISOString().split('T')[0],
            customer:   f.customerId?.name || 'Unknown',
            company:    f.customerId?.company || '',
            orderRef:   f.orderId?.orderNumber || '',
            eventName:  f.orderId?.eventName || '',
            department: f.orderId?.department || '',
            overall:    f.overallRating,
            food:       f.foodQuality,
            service:    f.service,
            time:       f.timeliness,
            sentiment:  f.sentiment,
            comment:    f.comment,
            tags:       f.tags.join(', ')
        }));

        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    submitFeedback,
    getFeedback,
    getFeedbackSummary,
    exportFeedback,
};
