/**
 * webhookController.js
 * Handles Razorpay webhook events for the Catering Ops Hub.
 * Removed: subscriptions (not needed for catering).
 * Handles: payment.captured, payment.failed
 */

const crypto = require('crypto');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Order   = require('../models/Order');
const generateNumber = require('../utils/generateNumber');

// ── Helper: sync amountPaid to Invoice + Order ────────────────────────────
const syncPayment = async (orderId, invoiceId, amount) => {
    // Update Order
    if (orderId) {
        const order = await Order.findOne({
            $or: [
                { _id: orderId },
                // also check by Razorpay notes.orderId (string)
            ],
        });
        if (order) {
            order.amountPaid = parseFloat((order.amountPaid + amount).toFixed(2));
            order.amountDue  = parseFloat((order.totalAmount - order.amountPaid).toFixed(2));
            order.paymentStatus = order.amountDue <= 0 ? 'Paid' : 'Partially Paid';
            if (order.amountDue < 0) order.amountDue = 0;
            await order.save();
        }
    }
    // Update Invoice
    if (invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        if (invoice) {
            invoice.amountPaid = parseFloat((invoice.amountPaid + amount).toFixed(2));
            invoice.balance    = parseFloat((invoice.totalAmount - invoice.amountPaid).toFixed(2));
            invoice.status     = invoice.balance <= 0 ? 'Paid' : 'Partially Paid';
            if (invoice.balance < 0) invoice.balance = 0;
            await invoice.save();
        }
    }
};

const webhookController = {
    webhook: async (req, res) => {
        try {
            // ── Signature Verification ─────────────────────────────────────
            const signature     = req.headers['x-razorpay-signature'];
            const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

            if (!webhookSecret) {
                console.error('RAZORPAY_WEBHOOK_SECRET not set in .env');
                return res.status(500).send('Webhook secret not configured');
            }
            if (!signature) {
                return res.status(400).send('Signature missing');
            }

            // Verify HMAC signature
            const body = req.body.toString();
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');

            if (expectedSignature !== signature) {
                console.warn('Razorpay webhook: signature mismatch');
                return res.status(400).send('Invalid signature');
            }

            const event = JSON.parse(body);
            console.log('Razorpay Webhook Event:', event.event);

            switch (event.event) {

                // ── Payment Captured (success) ─────────────────────────────
                case 'payment.captured': {
                    const payment = event.payload.payment.entity;

                    console.log('Payment captured:', payment.id);
                    console.log('Amount (paise):', payment.amount);
                    console.log('Razorpay Order ID:', payment.order_id);

                    const amount      = payment.amount / 100; // convert paise → rupees
                    const notes       = payment.notes || {};
                    const orderId     = notes.orderId   || null;
                    const invoiceId   = notes.invoiceId || null;
                    const customerId  = notes.customerId || null;

                    // Check if already processed (idempotency)
                    const alreadyRecorded = await Payment.findOne({
                        razorpayPaymentId: payment.id,
                    });
                    if (alreadyRecorded) {
                        console.log('Payment already recorded, skipping:', payment.id);
                        break;
                    }

                    // Auto-generate transaction ID
                    const transactionId = await generateNumber('TXN', Payment, 'transactionId');

                    // Save payment record
                    await Payment.create({
                        transactionId,
                        orderId:           orderId   || undefined,
                        invoiceId:         invoiceId || null,
                        customerId:        customerId || undefined,
                        amount,
                        method:            'Razorpay',
                        reference:         payment.id,
                        gateway:           'Razorpay',
                        razorpayOrderId:   payment.order_id,
                        razorpayPaymentId: payment.id,
                        status:            'Completed',
                        date:              new Date(payment.created_at * 1000),
                        notes:             `Razorpay payment: ${payment.id}`,
                    });

                    // Sync to Invoice + Order
                    await syncPayment(orderId, invoiceId, amount);

                    console.log(`Payment ${transactionId} recorded successfully for ₹${amount}`);
                    break;
                }

                // ── Payment Failed ─────────────────────────────────────────
                case 'payment.failed': {
                    const payment = event.payload.payment.entity;

                    console.warn('Payment failed:', payment.id, '| Reason:', payment.error_description);

                    const notes      = payment.notes || {};
                    const orderId    = notes.orderId  || null;
                    const invoiceId  = notes.invoiceId || null;
                    const customerId = notes.customerId || null;

                    const transactionId = await generateNumber('TXN', Payment, 'transactionId');

                    await Payment.create({
                        transactionId,
                        orderId:           orderId   || undefined,
                        invoiceId:         invoiceId || null,
                        customerId:        customerId || undefined,
                        amount:            payment.amount / 100,
                        method:            'Razorpay',
                        reference:         payment.id,
                        gateway:           'Razorpay',
                        razorpayOrderId:   payment.order_id,
                        razorpayPaymentId: payment.id,
                        status:            'Failed',
                        date:              new Date(payment.created_at * 1000),
                        notes:             `Failed: ${payment.error_description || 'Unknown reason'}`,
                    });

                    console.log(`Failed payment ${transactionId} logged`);
                    break;
                }

                // ── Refund Processed ───────────────────────────────────────
                case 'refund.processed': {
                    const refund = event.payload.refund.entity;
                    console.log('Refund processed:', refund.id, '| Payment:', refund.payment_id);

                    await Payment.findOneAndUpdate(
                        { razorpayPaymentId: refund.payment_id },
                        { $set: { status: 'Refunded' } }
                    );
                    break;
                }

                default:
                    console.log('Unhandled Razorpay event:', event.event);
            }

            return res.status(200).send('Webhook processed');

        } catch (error) {
            console.error('Webhook Error:', error);
            return res.status(500).send('Webhook processing error');
        }
    },
};

module.exports = { webhookController };
