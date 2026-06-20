const axios = require('axios');
const logger = require('../utils/logger');
const WhatsappLog = require('../models/WhatsappLog');

/**
 * Format phone number to E.164 without the '+' sign
 */
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  let cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }
  return cleanPhone;
};

/**
 * Generic reusable function to send a WhatsApp template via FlaxxaWapi
 */
const sendWhatsAppTemplate = async (phone, templateName, variables) => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) {
      throw new Error('Invalid phone number provided');
    }

    const Settings = require('../models/Settings');
    const dbSettings = await Settings.findOne();
    const wapiSettings = dbSettings?.integrations?.flaxxaWapi;
    const tokenFromDB  = (wapiSettings?.enabled && wapiSettings?.token) ? wapiSettings.token : null;
    const tokenFromEnv = process.env.WAPI_TOKEN || process.env.WAPI_API_TOKEN;
    const tokenHardcoded = '212656387069d4dcc8aa914';

    const wapiToken = tokenFromDB || tokenFromEnv || tokenHardcoded;
    const baseUrl   = process.env.WAPI_BASE_URL || 'https://wapi.flaxxa.com/api/v1';

    // Flaxxa requires EXACT language match per template approval
    let language = process.env.WAPI_LANGUAGE || 'en_US';
    if (['quotation_inquiry', 'enquiry_quotation'].includes(templateName)) {
      language = 'en';
    }

    if (!wapiToken) {
      throw new Error('WhatsApp not configured: Go to Settings → Integrations → FlaxxaWapi and save your WAPI token, or add WAPI_TOKEN to .env');
    }

    const parameters = variables.map((variable) => ({
      type: 'text',
      text: variable ? variable.toString() : 'N/A'
    }));

    // payment_link template takes 4 body variables (name, order, amount, URL)
    const components = parameters.length > 0 ? [{ type: 'body', parameters }] : [];

    const payload = { token: wapiToken, phone: formattedPhone, template_name: templateName, template_language: language, components };

    const response = await axios.post(`${baseUrl}/sendtemplatemessage`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.message_wamid === null) {
      const silentError = `Template "${templateName}" was rejected by FlaxxaWapi (message_wamid is null). Check template name spelling + approval status.`;
      logger.error(`[WhatsApp] ${silentError}`);
      if (WhatsappLog) {
        await WhatsappLog.create({ phone: formattedPhone, type: templateName, status: 'failed', response: { error: silentError } })
          .catch(err => logger.error('[WhatsApp] Failed to save log:', err.message));
      }
      return { success: false, error: silentError };
    }

    if (WhatsappLog && response?.data) {
      await WhatsappLog.create({ phone: formattedPhone, type: templateName, status: 'success', response: response.data })
        .catch(err => logger.error('[WhatsApp] Failed to save log:', err.message));
    }

    logger.info(`[WhatsApp] Template "${templateName}" sent to ${formattedPhone}`);
    return { success: true, data: response.data };

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`[WhatsApp] Failed to send "${templateName}": ${errorMessage}`);

    if (WhatsappLog) {
      await WhatsappLog.create({ phone, type: templateName, status: 'failed', response: { error: errorMessage } })
        .catch(err => logger.error('[WhatsApp] Failed to save log:', err.message));
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Sends a PDF document via WhatsApp using FlaxxaWapi (quotation_pdf template).
 */
const sendQuotationPDF = async (phone, pdfUrl, quoteNumber, customerName = 'Customer', eventName = 'Catering', amount = '') => {
  try {
    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone) throw new Error('Invalid phone number provided');

    const Settings = require('../models/Settings');
    const dbSettings = await Settings.findOne();
    const wapiSettings = dbSettings?.integrations?.flaxxaWapi;

    const wapiToken = (wapiSettings?.enabled && wapiSettings?.token)
      ? wapiSettings.token
      : (process.env.WAPI_TOKEN || process.env.WAPI_API_TOKEN || '212656387069d4dcc8aa914');
    const baseUrl = process.env.WAPI_BASE_URL || 'https://wapi.flaxxa.com/api/v1';
    const language = 'en';

    if (!wapiToken) throw new Error('WAPI_TOKEN is not configured');

    const payload = {
      token: wapiToken,
      phone: formattedPhone,
      template_name: 'quotation_inquiry',
      template_language: language,
      components: [
        {
          type: 'header',
          parameters: [{ type: 'document', document: { link: pdfUrl, filename: `Quotation-${quoteNumber}.pdf` } }]
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(customerName || 'Customer') },
            { type: 'text', text: String(eventName || 'Catering') },
            { type: 'text', text: String(quoteNumber) },
            { type: 'text', text: String(amount || '0') }
          ]
        }
      ]
    };

    const response = await axios.post(`${baseUrl}/sendtemplatemessage`, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data?.message_wamid === null) {
      const silentError = `PDF template "quotation_inquiry" rejected by FlaxxaWapi (message_wamid is null). Check template approval + PDF URL accessibility.`;
      logger.error(`[WhatsApp] ${silentError}`);
      if (WhatsappLog) {
        await WhatsappLog.create({ phone: formattedPhone, type: 'quotation_inquiry', status: 'failed', response: { error: silentError } })
          .catch(err => logger.error('[WhatsApp] Failed to save log:', err.message));
      }
      return { success: false, error: silentError };
    }

    if (WhatsappLog && response?.data) {
      await WhatsappLog.create({ phone: formattedPhone, type: 'quotation_inquiry', status: 'success', response: response.data })
        .catch(err => logger.error('[WhatsApp] Failed to save log:', err.message));
    }

    logger.info(`[WhatsApp] PDF quotation sent to ${formattedPhone}`);
    return { success: true, data: response.data };

  } catch (error) {
    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
    logger.error(`[WhatsApp] sendQuotationPDF failed: ${errorMessage}`);

    if (WhatsappLog) {
      await WhatsappLog.create({ phone, type: 'quotation_inquiry', status: 'failed', response: { error: errorMessage } })
        .catch(err => logger.error('[WhatsApp] Failed to save log:', err.message));
    }

    return { success: false, error: errorMessage };
  }
};

/**
 * Returns the public base URL of this API for building download links.
 */
const getApiBaseUrl = () => {
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, '');
  if (process.env.VITE_API_URL) return process.env.VITE_API_URL.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  if (process.env.RAILWAY_STATIC_URL) return `https://${process.env.RAILWAY_STATIC_URL}`;
  return 'http://localhost:5000';
};

/**
 * Sends quotation template (quotation_inquiry)
 */
const sendQuotationTemplate = async (phone, customerName, serviceType, quoteNo, amount) => {
  return await sendWhatsAppTemplate(phone, 'quotation_inquiry', [
    customerName || 'Customer',
    serviceType || 'Catering',
    quoteNo || 'N/A',
    amount || '0'
  ]);
};

/**
 * Sends quotation PDF via WhatsApp (substitutes localhost URL in dev)
 */
const sendQuotationWithPDF = async (phone, pdfUrl, quoteNumber, customerName, eventName, amount) => {
  const isLocal = pdfUrl.includes('localhost') || pdfUrl.includes('127.0.0.1');
  if (isLocal) {
    logger.warn('[WhatsApp] Localhost PDF URL detected — substituting with public dummy PDF for delivery test.');
    pdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
  }
  const pdfResponse = await sendQuotationPDF(phone, pdfUrl, quoteNumber, customerName, eventName, amount);
  return { templateResponse: { success: true }, pdfResponse };
};

module.exports = {
  sendWhatsAppTemplate,
  sendQuotationPDF,
  sendQuotationTemplate,
  sendQuotationWithPDF,
  getApiBaseUrl
};
