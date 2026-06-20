const Order = require('../models/Order');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get orders formatted as calendar events
// @route   GET /api/calendar/events
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getCalendarEvents = async (req, res, next) => {
    try {
        const { from, to, department, status, view } = req.query;

        const query = {};

        // Only show non-archived, non-draft orders on the calendar by default
        query.isArchived = false;

        if (status) {
            query.status = status;
        } else {
            // Default: don't show Draft or Cancelled on the active calendar
            query.status = { $nin: ['Draft', 'Cancelled'] };
        }

        if (department) {
            query.department = department; // e.g. "South Indian", "Bakery"
        }

        // Date range filtering
        if (from || to) {
            query.eventDate = {};
            if (from) query.eventDate.$gte = new Date(from);
            if (to)   query.eventDate.$lte = new Date(to);
        } else {
            // Default to current month if no dates provided
            const now = new Date();
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            query.eventDate = { $gte: firstDay, $lte: lastDay };
        }

        const orders = await Order.find(query)
            .populate('customerId', 'name phone')
            .sort({ eventDate: 1 })
            .lean();

        // Map orders to calendar event format mapping suitable for react-big-calendar or fullcalendar
        const events = orders.map((order) => {
            
            // Determine color coding based on status
            let color = '#3788d8'; // Default blue
            switch (order.status) {
                case 'Confirmed':      color = '#0dcaf0'; break; // Info Blue
                case 'In-Preparation': color = '#fd7e14'; break; // Orange
                case 'Ready':          color = '#ffc107'; break; // Yellow
                case 'Dispatched':     color = '#6f42c1'; break; // Purple
                case 'Delivered':      color = '#198754'; break; // Green
            }

            return {
                id:             order._id,
                title:          `${order.orderNumber} - ${order.eventName} (${order.pax} pax)`,
                start:          order.eventDate,
                end:            order.eventDate, // One-day events for catering usually
                allDay:         true,
                color:          color,
                // Extra meta data for event popups
                orderNumber:    order.orderNumber,
                eventName:      order.eventName,
                customerName:   order.customerId?.name || 'Unknown',
                customerPhone:  order.customerId?.phone || '',
                pax:            order.pax,
                department:     order.department,
                venue:          order.venue,
                status:         order.status,
                kitchenStatus:  order.kitchenStatus,
                paymentStatus:  order.paymentStatus,
                amountDue:      order.amountDue,
            };
        });

        res.json({
            success: true,
            count: events.length,
            view: view || 'month',
            data: events,
        });

    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCalendarEvents,
};
