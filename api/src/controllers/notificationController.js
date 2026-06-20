const { sendWhatsAppMessage } = require('../services/whatsappService');
const { createError } = require('../middleware/errorHandler');

// ── SEND WHATSAPP MESSAGE ─────────────────────────────────────────────────
const sendWhatsApp = async (req, res, next) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return next(createError(400, 'Phone and message are required'));
        }

        const result = await sendWhatsAppMessage({ 
            to: phone, 
            templateName: 'hare_krishna_market_order_confirmation', // Default for legacy/test
            variables: [phone, "TEST", new Date().toLocaleDateString()] 
        });

        if (!result || result.success === false) {
             return res.status(200).json({
                success: false,
                message: `WhatsApp delivery failed: ${result?.error || 'Unknown error'}`,
            });
        }

        res.json({
            success: true,
            message: `WhatsApp message sent successfully`,
            data: result,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { sendWhatsApp };
