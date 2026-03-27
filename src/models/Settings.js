const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        // Business Profile
        businessName: { type: String, default: 'Catering Ops Hub' },
        email: { type: String, default: 'contact@cateringopshub.com' },
        phone: { type: String, default: '+919876543210' },
        address: { type: String, default: '123 Main Street, City' },
        gstin: { type: String, default: '' },
        logoUrl: { type: String, default: '' },

        // Document Prefixes
        invoicePrefix: { type: String, default: 'INV' },
        quotePrefix: { type: String, default: 'QT' },
        orderPrefix: { type: String, default: 'ORD' },

        // Financial Defaults
        defaultTaxRate: { type: Number, default: 5 }, // e.g., 5% GST on catering by default
        gstSettings: {
            cgstRate: { type: Number, default: 2.5 },
            sgstRate: { type: Number, default: 2.5 },
            igstRate: { type: Number, default: 5 },
        },

        // Integrations (Credentials are usually in .env, but status/tokens live here)
        integrations: {
            razorpay: {
                isConnected: { type: Boolean, default: false },
                // Actual keys should stay in .env, but we can track connection state
            },
            flaxxa: {
                isConnected: { type: Boolean, default: false },
            },
        },
    },
    { timestamps: true }
);

// We only ever need ONE settings document per business
// This static method ensures we always get the same doc (or creates one if missing)
settingsSchema.statics.getGlobalSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
