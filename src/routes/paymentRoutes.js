const express = require('express');
const router = express.Router();
const {
    createRazorpayOrder,
    recordPayment,
    getPayments,
    getPaymentSummary,
    reconcilePayment,
    exportPayments,
} = require('../controllers/paymentController');
const { webhookController } = require('../controllers/webhookController');
const { protect } = require('../middleware/authMiddleware');

// ── Razorpay Webhook — NO auth (Razorpay calls this directly) ─────────────
// IMPORTANT: must be raw body (express.raw) for signature verification
// This is handled in server.js with a special middleware for this route
router.post(
    '/razorpay/webhook',
    express.raw({ type: 'application/json' }),
    webhookController.webhook
);

// ── All other payment routes require JWT auth ─────────────────────────────
router.use(protect);

router.post('/razorpay/create-order', createRazorpayOrder); // Create Razorpay order

// IMPORTANT: named paths before /:id
router.get('/summary', getPaymentSummary);     // GET  /api/payments/summary
router.get('/export',  exportPayments);        // GET  /api/payments/export

router.route('/')
    .get(getPayments)                          // GET  /api/payments
    .post(recordPayment);                      // POST /api/payments

router.patch('/:id/reconcile', reconcilePayment); // PATCH /api/payments/:id/reconcile

module.exports = router;
