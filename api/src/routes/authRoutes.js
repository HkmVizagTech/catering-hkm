const express = require('express');
const { body } = require('express-validator');
const { login, logout, getMe, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation for login
const loginValidation = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
];

// ── Auth Routes ───────────────────────────────────────────────────────────────

// POST /api/auth/login
router.post('/login', loginValidation, login);

// POST /api/auth/logout
router.post('/logout', protect, logout);

// GET /api/auth/me
router.get('/me', protect, getMe);

// GET /api/auth/status  (alias)
router.get('/status', protect, getMe);

// POST /api/auth/forgot-password  — body: { email }
router.post('/forgot-password', forgotPassword);

// PUT /api/auth/reset-password/:token   — body: { password }
router.put('/reset-password/:token', resetPassword);

module.exports = router;
