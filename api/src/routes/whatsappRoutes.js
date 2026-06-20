const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  sendOrderConfirmation,
  sendPaymentLink,
  sendPaymentSuccess,
  sendOrderDispatched,
  sendOrderDelivered,
  sendQuotation,
  sendMarriageQuotation
} = require('../controllers/whatsappController');

router.post('/order-confirmation', protect, sendOrderConfirmation);
router.post('/payment-link', protect, sendPaymentLink);
router.post('/payment-success', protect, sendPaymentSuccess);
router.post('/order-dispatched', protect, sendOrderDispatched);
router.post('/order-delivered', protect, sendOrderDelivered);
router.post('/quotation', protect, sendQuotation);
router.post('/marriage-quotation', protect, sendMarriageQuotation);

module.exports = router;
