const express = require('express');
const router = express.Router();
const {
    getCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
} = require('../controllers/customerController');
const { protect } = require('../middleware/authMiddleware');

// All customer routes require authentication
router.use(protect);

router.route('/')
    .get(getCustomers)       // GET  /api/customers
    .post(createCustomer);   // POST /api/customers

router.route('/:id')
    .get(getCustomerById)    // GET    /api/customers/:id
    .put(updateCustomer)     // PUT    /api/customers/:id
    .delete(deleteCustomer); // DELETE /api/customers/:id

module.exports = router;
