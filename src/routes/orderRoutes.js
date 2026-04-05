const express = require('express');
const router = express.Router();
const {
    getOrders,
    createOrder,
    getOrderById,
    updateOrder,
    updateOrderStatus,
    archiveOrder,
    exportOrders,
    sendOrderWhatsApp,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// IMPORTANT: /export must come BEFORE /:id so it isn't treated as an id param
router.get('/export', exportOrders);         // GET  /api/orders/export

router.route('/')
    .get(getOrders)                          // GET  /api/orders
    .post(createOrder);                      // POST /api/orders

router.route('/:id')
    .get(getOrderById)                       // GET    /api/orders/:id
    .put(updateOrder);                       // PUT    /api/orders/:id

router.patch('/:id/status', updateOrderStatus);   // PATCH /api/orders/:id/status
router.patch('/:id/archive', archiveOrder);        // PATCH /api/orders/:id/archive
router.post('/:id/send-whatsapp', sendOrderWhatsApp); // POST /api/orders/:id/send-whatsapp

module.exports = router;
