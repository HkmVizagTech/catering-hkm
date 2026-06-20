const express = require('express');
const router = express.Router();
const { sendWhatsApp } = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/whatsapp', sendWhatsApp);

module.exports = router;
