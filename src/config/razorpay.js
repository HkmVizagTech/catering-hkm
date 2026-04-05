const Razorpay = require('razorpay');
const logger = require('../utils/logger');

let _razorpayInstance = null;

const initRazorpay = () => {
    if (!_razorpayInstance) {
        const key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
        const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();

        if (!key_id || !key_secret) {
            logger.error('❌ Razorpay Error: KEY_ID or KEY_SECRET is missing in .env');
            return null;
        }

        try {
            _razorpayInstance = new Razorpay({
                key_id: key_id,
                key_secret: key_secret,
            });
            logger.info(`✅ Razorpay SDK Initialized with ID: ${key_id.slice(0, 10)}...`);
        } catch (err) {
            logger.error('❌ Razorpay SDK Init Failed:', { error: err.message });
            return null;
        }
    }
    return _razorpayInstance;
};

module.exports = { initRazorpay };
