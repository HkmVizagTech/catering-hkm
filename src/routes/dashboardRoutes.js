const express = require('express');
const router = express.Router();
const { getDashboardSummary, getDashboardStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getDashboardSummary);  // GET /api/dashboard/summary
router.get('/stats', getDashboardStats);    // GET /api/dashboard/stats

module.exports = router;
