const express = require('express');
const router = express.Router();
const {
    getQuotes,
    createQuote,
    getQuoteById,
    updateQuote,
    deleteQuote,
    convertQuoteToOrder,
    sendQuoteWhatsApp,
    downloadQuotePDF,
} = require('../controllers/quoteController');
const { protect } = require('../middleware/authMiddleware');

// Public route for PDF download
router.get('/download/:id', downloadQuotePDF);

// All quote routes require authentication
router.use(protect);

router.route('/')
    .get(getQuotes)       // GET  /api/quotes
    .post(createQuote);   // POST /api/quotes

router.route('/:id')
    .get(getQuoteById)    // GET    /api/quotes/:id
    .put(updateQuote)     // PUT    /api/quotes/:id
    .delete(deleteQuote); // DELETE /api/quotes/:id

router.post('/:id/convert', convertQuoteToOrder); // POST /api/quotes/:id/convert
router.post('/:id/send-whatsapp', sendQuoteWhatsApp); // POST /api/quotes/:id/send-whatsapp

module.exports = router;
