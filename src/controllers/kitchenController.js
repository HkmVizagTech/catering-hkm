const Order = require('../models/Order');

// ── GET KITCHEN ORDERS ──────────────────────────────────────────────────────
const getKitchenOrders = async (req, res, next) => {
    try {
        // Fetch upcoming confirmed or in-prep orders
        const orders = await Order.find({
            status: { $in: ['Confirmed', 'In-Preparation'] }, 
            isArchived: false
        })
        .populate('customerId', 'name')
        .populate('lineItems.menuItemId', 'name category')
        .sort({ eventDate: 1 })
        .lean();

        // Transform for KDS frontend expectations
        const transformed = orders.map(ord => ({
            id: ord._id,
            eventName: ord.eventName || ord.customerId?.name || "Event Order",
            date: ord.eventDate,
            status: ord.status === 'In-Preparation' ? 'In-Prep' : 'Confirmed',
            dueTime: "12:00 PM",
            menuItems: (ord.lineItems || []).map(i => i.name).filter(Boolean),
            headcount: ord.pax || 0
        }));

        res.json({
            success: true,
            data: transformed
        });
    } catch (err) {
        next(err);
    }
};

// ── UPDATE ORDER STATUS ─────────────────────────────────────────────────────
const updateKitchenStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Map frontend KDS status back to Order model statuses
        // Confirmed -> Confirmed
        // In-Prep -> Processing
        // Ready -> Ready (or Shipped/Delivered)
        let backendStatus = 'Confirmed';
        if (status === 'In-Prep') backendStatus = 'Processing';
        if (status === 'Ready') backendStatus = 'Shipped';

        const order = await Order.findByIdAndUpdate(
            id,
            { status: backendStatus },
            { new: true }
        );

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // Emit socket event if io is available
        const io = req.app.get('io');
        if (io) {
            io.emit('kitchen_update', { orderId: id, status: backendStatus });
        }

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            data: order
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getKitchenOrders,
    updateKitchenStatus
};
