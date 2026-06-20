const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const serverless = require('serverless-http');
const connectDB = require('./src/config/db');
const { errorHandler } = require('./src/middleware/errorHandler');

// ─── Load Env & Connect DB ────────────────────────────────────────────────
// Note: In Vercel, env variables are provided via the UI, but this is fine for local
dotenv.config();
connectDB();

const app = express();

// ─── Security & Logging ────────────────────────────────────────────────────
app.use(helmet());
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
}

// ─── Core Middleware ───────────────────────────────────────────────────────
app.use(cors({
    origin: true, // Allow same-origin and all for now as per instructions
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Import Routes ─────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const userRoutes = require('./src/routes/userRoutes');
const menuRoutes = require('./src/routes/menuRoutes');
const quoteRoutes = require('./src/routes/quoteRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const invoiceRoutes  = require('./src/routes/invoiceRoutes');
const paymentRoutes  = require('./src/routes/paymentRoutes');
const expenseRoutes  = require('./src/routes/expenseRoutes');
const reportRoutes   = require('./src/routes/reportRoutes');
const calendarRoutes = require('./src/routes/calendarRoutes');
const kitchenRoutes  = require('./src/routes/kitchenRoutes');
const feedbackRoutes = require('./src/routes/feedbackRoutes');
const settingsRoutes = require('./src/routes/settingsRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: '🍽️  Catering Ops Hub API is running on Vercel',
        version: '1.0.0'
    });
});

// ─── Mount Routes ─────────────────────────────────────────────────────────
// Note: These paths should match the incoming requests after Vercel routing
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices',  invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/whatsapp', require('./src/routes/whatsappRoutes'));

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
});

// ─── Centralized Error Handler ─────────────────────────────────────────────
app.use(errorHandler);

// Note: Socket.io is removed here as it is not supported in Vercel Serverless Functions.
// To use real-time features, consider using Pusher or Ably.

module.exports = app;
module.exports.handler = serverless(app);
