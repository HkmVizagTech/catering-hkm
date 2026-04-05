const express = require('express');
const router = express.Router();
const { getDashboardStats, getFinancialSummary } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getDashboardStats);
router.get('/financial', getFinancialSummary);

module.exports = router;
