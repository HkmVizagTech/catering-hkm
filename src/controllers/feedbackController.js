const Feedback = require('../models/Feedback');
const Settings = require('../models/Settings');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// ── GET ALL FEEDBACK ────────────────────────────────────────────────────────
const getAllFeedback = async (req, res, next) => {
    try {
        const feedback = await Feedback.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: feedback
        });
    } catch (err) {
        next(err);
    }
};

// ── SUBMIT FEEDBACK ─────────────────────────────────────────────────────────
const submitFeedback = async (req, res, next) => {
    try {
        // Check if feedback is enabled in settings
        const settings = await Settings.findOne();
        if (settings && !settings.isFeedbackEnabled) {
            return res.status(403).json({
                success: false,
                message: "Feedback collection is currently disabled by the administrator."
            });
        }

        const { orderId, customerId, rating, comment, tags } = req.body;
        
        let customerName = "Guest";
        if (orderId) {
            let orderInfo = null;
            if (mongoose.Types.ObjectId.isValid(orderId)) {
                orderInfo = await Order.findById(orderId).populate('customerId');
            } else {
                orderInfo = await Order.findOne({ orderNumber: String(orderId) }).populate('customerId');
            }
            
            if (orderInfo && orderInfo.customerId) {
                customerName = orderInfo.customerId.name || "Guest";
            } else if (orderInfo && orderInfo.customerName) {
                customerName = orderInfo.customerName; // if stored as string occasionally
            }
        }
        
        if (req.body.customerName) {
            customerName = req.body.customerName;
        }

        const newFeedback = await Feedback.create({
            orderId,
            customerId,
            customerName,
            rating,
            comment,
            tags: tags || []
        });

        // Emit live update via socket
        const io = req.app.get('io');
        if (io) {
            io.emit('new_feedback', newFeedback);
        }

        res.status(201).json({
            success: true,
            message: "Feedback submitted successfully. Thank you!",
            data: newFeedback
        });
    } catch (err) {
        next(err);
    }
};

// ── UPDATE FEEDBACK STATUS ──────────────────────────────────────────────────
const updateFeedbackStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const feedback = await Feedback.findByIdAndUpdate(
            id,
            { status },
            { new: true, runValidators: true }
        );

        if (!feedback) return res.status(404).json({ success: false, message: "Feedback not found" });

        res.json({
            success: true,
            message: "Feedback status updated",
            data: feedback
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllFeedback,
    submitFeedback,
    updateFeedbackStatus
};
