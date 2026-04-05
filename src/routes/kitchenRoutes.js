const express = require('express');
const router = express.Router();
const { getKitchenOrders, updateKitchenStatus } = require('../controllers/kitchenController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/orders', getKitchenOrders);
router.put('/orders/:id/status', updateKitchenStatus);

module.exports = router;
