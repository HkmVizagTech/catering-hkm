const Settings = require('../models/Settings');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get Global Business Settings
// @route   GET /api/settings
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getSettings = async (req, res, next) => {
    try {
        const settings = await Settings.getGlobalSettings();
        
        res.json({
            success: true,
            data: settings,
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update Global Business Settings
// @route   PUT /api/settings
// @access  Private (Admin Only)
// ─────────────────────────────────────────────────────────────────────────────
const updateSettings = async (req, res, next) => {
    try {
        const updates = req.body;
        
        // Prevent accidental overriding of integrations state directly via this endpoint
        if (updates.integrations) {
            delete updates.integrations; 
        }

        const settings = await Settings.getGlobalSettings();
        
        Object.keys(updates).forEach((key) => {
            if (updates[key] !== undefined) {
                settings[key] = updates[key];
            }
        });

        await settings.save();

        res.json({
            success: true,
            message: 'Settings updated successfully',
            data: settings,
        });

    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Toggle/Configure Razorpay State (mocking for now, real keys in .env)
// @route   POST /api/settings/razorpay/configure
// @access  Private (Admin Only)
// ─────────────────────────────────────────────────────────────────────────────
const configureRazorpay = async (req, res, next) => {
    try {
        const { isConnected } = req.body;
        
        const settings = await Settings.getGlobalSettings();
        settings.integrations.razorpay.isConnected = isConnected;
        await settings.save();

        res.json({
            success: true,
            message: `Razorpay integration ${isConnected ? 'enabled' : 'disabled'}`,
            data: settings.integrations.razorpay,
        });

    } catch (err) {
        next(err);
    }
};

module.exports = {
    getSettings,
    updateSettings,
    configureRazorpay,
};
