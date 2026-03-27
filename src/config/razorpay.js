/**
 * razorpay.js — Razorpay SDK Config
 * Lazy-initializes Razorpay so the server doesn't crash on startup if keys are missing.
 * Keys are only required when payment routes are actually called.
 */
const Razorpay = require('razorpay');

let _razorpay = null;

const getRazorpay = () => {
    if (!_razorpay) {
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            throw new Error(
                'Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your .env file.'
            );
        }
        _razorpay = new Razorpay({
            key_id:     process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    }
    return _razorpay;
};

// For backward compatibility — use getRazorpay() instead of razorpay directly
const razorpay = new Proxy({}, {
    get: (_, prop) => getRazorpay()[prop],
});

module.exports = { razorpay, getRazorpay };
