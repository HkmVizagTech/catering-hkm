const { sendWhatsAppTemplate } = require('../services/wapiService');

// Template variables mappings:
// order_confirmation: customerName, orderId, eventDate, venue, guests, totalAmount
// payment_request: customerName, orderId, amount, paymentURL
// payment_success: customerName, orderId, amount, paymentDate
// order_dispatched: customerName, orderId, items, deliveryTime, address
// order_delivered: customerName, orderId
// quotation_inquiry: customerName, serviceType, quoteNo, amount
// enquiry_quotation: customerName, quoteNo, amount

const sendOrderConfirmation = async (req, res) => {
  try {
    const { phone, customerName, orderId, eventDate, venue, guests, totalAmount } = req.body;
    const variables = [customerName, orderId, eventDate, venue, guests, totalAmount];
    const result = await sendWhatsAppTemplate(phone, 'order_confirmation', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Order confirmation sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendPaymentLink = async (req, res) => {
  try {
    const { phone, customerName, orderId, amount, paymentURL } = req.body;
    const variables = [customerName, orderId, amount, paymentURL];
    const result = await sendWhatsAppTemplate(phone, 'payment_request', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Payment link sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendPaymentSuccess = async (req, res) => {
  try {
    const { phone, customerName, orderId, amount, paymentDate } = req.body;
    const variables = [customerName, orderId, amount, paymentDate];
    const result = await sendWhatsAppTemplate(phone, 'payment_success', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Payment success sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendOrderDispatched = async (req, res) => {
  try {
    const { phone, customerName, orderId, items, deliveryTime, address } = req.body;
    const variables = [customerName, orderId, items, deliveryTime, address];
    const result = await sendWhatsAppTemplate(phone, 'order_dispatched', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Order dispatched sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendOrderDelivered = async (req, res) => {
  try {
    const { phone, customerName, orderId } = req.body;
    const variables = [customerName, orderId];
    const result = await sendWhatsAppTemplate(phone, 'order_delivered', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Order delivered sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendQuotation = async (req, res) => {
  try {
    const { phone, customerName, serviceType, quoteNo, amount } = req.body;
    const variables = [customerName, serviceType, quoteNo, amount];
    const result = await sendWhatsAppTemplate(phone, 'quotation_inquiry', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Quotation sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendMarriageQuotation = async (req, res) => {
  try {
    const { phone, customerName, quoteNo, amount } = req.body;
    const variables = [customerName, quoteNo, amount];
    const result = await sendWhatsAppTemplate(phone, 'enquiry_quotation', variables);
    if (!result.success) {
      return res.status(500).json({ success: false, message: result.error || 'Failed to send WhatsApp', error: result.error });
    }
    res.status(200).json({ success: true, message: 'Marriage quotation sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  sendOrderConfirmation,
  sendPaymentLink,
  sendPaymentSuccess,
  sendOrderDispatched,
  sendOrderDelivered,
  sendQuotation,
  sendMarriageQuotation
};
