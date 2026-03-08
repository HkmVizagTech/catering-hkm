const express = require('express');
const router = express.Router();
const {
    getMenuItems,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleAvailability,
} = require('../controllers/menuController');
const { protect } = require('../middleware/authMiddleware');

// All menu routes require authentication
router.use(protect);

router.route('/')
    .get(getMenuItems)        // GET  /api/menu
    .post(createMenuItem);    // POST /api/menu

router.route('/:id')
    .put(updateMenuItem)      // PUT    /api/menu/:id
    .delete(deleteMenuItem);  // DELETE /api/menu/:id

router.patch('/:id/availability', toggleAvailability); // PATCH /api/menu/:id/availability

module.exports = router;
