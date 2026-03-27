const express = require('express');
const router = express.Router();
const {
    getSettings,
    updateSettings,
    configureRazorpay,
} = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);



router.use(authorize('admin'));

router.route('/')
    .get(getSettings)
    .put(updateSettings);

router.post('/razorpay/configure', configureRazorpay);

module.exports = router;
