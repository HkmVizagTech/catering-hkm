const Settings = require('../models/Settings');

// ── GET SETTINGS ──────────────────────────────────────────────────────────
const getSettings = async (req, res, next) => {
    try {
        // We assume a single settings document for now.
        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = await Settings.create({}); // Create default if doesn't exist
        }

        res.json({
            success: true,
            data: settings
        });
    } catch (err) {
        next(err);
    }
};

// ── UPDATE SETTINGS ───────────────────────────────────────────────────────
const updateSettings = async (req, res, next) => {
    try {
        const updateData = req.body;
        updateData.lastUpdated = Date.now();

        let settings = await Settings.findOne();
        
        if (!settings) {
            settings = await Settings.create(updateData);
        } else {
            settings = await Settings.findByIdAndUpdate(
                settings._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
        }

        res.json({
            success: true,
            message: "Settings updated successfully",
            data: settings
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getSettings,
    updateSettings
};
