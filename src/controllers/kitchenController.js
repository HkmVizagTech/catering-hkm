const Order = require('../models/Order');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all active orders for today (Kitchen View)
// @route   GET /api/kitchen/orders
// @access  Private (Kitchen Staff / Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getKitchenOrders = async (req, res, next) => {
    try {
        const { department } = req.query; // optional filter for specific kitchens (e.g., Bakery)

        // Find orders for today (or very near future) that are not archived or draft
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const query = {
            isArchived: false,
            status: { $in: ['Confirmed', 'In-Preparation', 'Ready'] },
            eventDate: { $gte: today, $lt: tomorrow },
        };

        if (department) {
            query.department = department;
        }

        const orders = await Order.find(query)
            .populate('customerId', 'name')
            .sort({ eventDate: 1, createdAt: 1 })
            .lean();

        res.json({
            success: true,
            count: orders.length,
            data: orders,
        });

    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update kitchen status of an order
// @route   PATCH /api/kitchen/orders/:id/status
// @access  Private (Kitchen Staff / Admin)
// ─────────────────────────────────────────────────────────────────────────────
const updateKitchenStatus = async (req, res, next) => {
    try {
        const { kitchenStatus } = req.body;
        
        if (!['Pending', 'In-Progress', 'Ready'].includes(kitchenStatus)) {
            return next(createError(400, 'Invalid kitchen status'));
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return next(createError(404, 'Order not found'));
        }

        order.kitchenStatus = kitchenStatus;

        // Auto-update overall order status if kitchen marks it ready
        if (kitchenStatus === 'In-Progress') {
            order.status = 'In-Preparation';
        } else if (kitchenStatus === 'Ready') {
            order.status = 'Ready';
        }

        await order.save();

        // 🔥 BROADCAST TO ALL CONNECTED KITCHEN CLIENTS VIA SOCKET.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('kitchen:statusUpdated', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                kitchenStatus: order.kitchenStatus,
                status: order.status,
                department: order.department,
            });
        }

        res.json({
            success: true,
            message: `Kitchen status updated to ${kitchenStatus}`,
            data: order,
        });

    } catch (err) {
        next(err);
    }
};

module.exports = {
    getKitchenOrders,
    updateKitchenStatus,
};
