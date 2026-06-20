const express = require('express');
const router = express.Router();
const { getCalendarEvents } = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All calendar routes are protected

// @route   GET /api/calendar/events
// @desc    Get orders formatted as calendar events
router.get('/events', getCalendarEvents);

module.exports = router;
