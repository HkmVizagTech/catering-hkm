const express = require('express');
const router = express.Router();
const {
    getInvoices,
    createInvoice,
    getInvoiceById,
    updateInvoice,
    downloadInvoicePDF,
    sendInvoice,
    bulkExport,
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

// Allow customers to download their PDF without a login token
router.get('/:id/pdf', downloadInvoicePDF);

router.use(protect);

// IMPORTANT: specific paths before /:id
router.post('/bulk-export', bulkExport);         // POST /api/invoices/bulk-export

router.route('/')
    .get(getInvoices)                            // GET  /api/invoices
    .post(createInvoice);                        // POST /api/invoices

router.route('/:id')
    .get(getInvoiceById)                         // GET  /api/invoices/:id
    .put(updateInvoice);                         // PUT  /api/invoices/:id
router.post('/:id/send', sendInvoice);           // POST /api/invoices/:id/send

module.exports = router;
