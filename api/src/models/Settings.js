const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Branding & Profile
  businessName: {
    type: String,
    default: 'The Satvata Foods - ISKCON Catering'
  },
  gstin: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },

  // Integrations
  integrations: {
    razorpay: {
      enabled: { type: Boolean, default: false },
      keyId: { type: String, default: '' },
      keySecret: { type: String, default: '' }
    },
    whatsapp: {
      enabled: { type: Boolean, default: false },
      apiKey: { type: String, default: '' },      // Access Token
      phoneNumberId: { type: String, default: '' },
      businessAccountId: { type: String, default: '' }
    },
    flaxxaWapi: {
      enabled: { type: Boolean, default: false },
      token: { type: String, default: '' },
      connectedNumber: { type: String, default: '' },
      templateStatus: { type: String, default: 'Pending' }
    }
  },

  // Notification Toggles
  notifications: {
    orderConfirmation: { type: Boolean, default: true },
    kitchenReminder: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true }
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
