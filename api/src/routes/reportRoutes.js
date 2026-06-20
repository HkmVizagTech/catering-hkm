const express = require('express');
const router = express.Router();
const { 
    getReportSummary, 
    getAccountBalances, 
    getGstSummary, 
    getExpenseBreakdown 
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getReportSummary);
router.get('/accounts', getAccountBalances);
router.get('/gst', getGstSummary);
router.get('/expenses-breakdown', getExpenseBreakdown);

module.exports = router;
