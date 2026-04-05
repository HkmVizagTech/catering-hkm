const express = require('express');
const router = express.Router();
const { 
    getExpenses, 
    createExpense, 
    updateExpense, 
    deleteExpense, 
    getExpenseSummary 
} = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes

router.get('/', getExpenses);
router.post('/', createExpense);
router.get('/summary', getExpenseSummary);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
