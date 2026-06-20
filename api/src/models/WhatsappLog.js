const mongoose = require('mongoose');

const WhatsappLogSchema = new mongoose.Schema({
    phone: { type: String, required: true },
    type: { type: String, required: true }, // e.g. 'order_created', 'payment_request'
    status: { type: String, enum: ['success', 'failed'], required: true },
    response: { type: Object },
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WhatsappLog', WhatsappLogSchema);
