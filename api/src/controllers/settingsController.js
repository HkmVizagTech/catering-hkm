const Settings = require('../models/Settings');

// ── GET SETTINGS ──────────────────────────────────────────────────────────
const getSettings = async (req, res, next) => {
    try {
        let settings = await Settings.findOne();

        if (!settings) {
            settings = await Settings.create({});
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
            // Deep-merge integrations so partial updates don't wipe other fields
            if (updateData.integrations) {
                const existing = settings.integrations || {};
                updateData.integrations = {
                    razorpay: {
                        ...(existing.razorpay?.toObject ? existing.razorpay.toObject() : existing.razorpay || {}),
                        ...(updateData.integrations.razorpay || {})
                    },
                    whatsapp: {
                        ...(existing.whatsapp?.toObject ? existing.whatsapp.toObject() : existing.whatsapp || {}),
                        ...(updateData.integrations.whatsapp || {})
                    }
                };
            }

            // Deep-merge notifications
            if (updateData.notifications) {
                const existing = settings.notifications || {};
                updateData.notifications = {
                    ...(existing.toObject ? existing.toObject() : existing),
                    ...updateData.notifications
                };
            }

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
