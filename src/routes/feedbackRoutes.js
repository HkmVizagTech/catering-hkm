const express = require('express');
const router = express.Router();
const {
    submitFeedback,
    getFeedback,
    getFeedbackSummary,
    exportFeedback,
} = require('../controllers/feedbackController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // All feedback routes are protected

// IMPORTANT: specific named parameters must come before flexible ones like /:id
router.get('/summary', getFeedbackSummary);
router.get('/export', exportFeedback);

router.route('/')
    .get(getFeedback)            // List all feedback (with filters)
    .post(submitFeedback);       // Submit feedback for an order

module.exports = router;
