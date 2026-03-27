const express = require('express');
const router = express.Router();
const { getKitchenOrders, updateKitchenStatus } = require('../controllers/kitchenController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect); // All kitchen routes are protected
// Only Admin or Kitchen Staff can access these
router.use(authorize('admin', 'kitchen'));

// @route   GET /api/kitchen/orders
// @desc    Get all active orders for today (Kitchen View)
router.get('/orders', getKitchenOrders);

// @route   PATCH /api/kitchen/orders/:id/status
// @desc    Update kitchen status of an order
router.patch('/orders/:id/status', updateKitchenStatus);

module.exports = router;
