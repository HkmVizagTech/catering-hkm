const express = require('express');
const router = express.Router();
const { getAllFeedback, submitFeedback, updateFeedbackStatus } = require('../controllers/feedbackController');
const { protect } = require('../middleware/authMiddleware');

// Public route for customers to submit feedback
router.post('/', submitFeedback);

// Admin-only routes
router.use(protect);
router.get('/', getAllFeedback);
router.put('/:id', updateFeedbackStatus);

module.exports = router;
