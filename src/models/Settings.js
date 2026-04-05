const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  // Branding & Profile
  businessName: {
    type: String,
    default: 'The Higher Taste - ISKCON Catering'
  },
  gstin: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  
  // Integrations Status
  isRazorpayConnected: {
    type: Boolean,
    default: true
  },
  isGupshupConnected: {
    type: Boolean,
    default: true
  },
  isFeedbackEnabled: {
    type: Boolean,
    default: true
  },

  // Notification Toggles
  notifications: {
    orderConfirmations: {
      type: Boolean,
      default: true
    },
    prepReminders: {
      type: Boolean,
      default: true
    },
    paymentDueAlerts: {
      type: Boolean,
      default: true
    }
  },

  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
