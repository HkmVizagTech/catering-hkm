const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const connectDB = require('./src/config/db');
const { errorHandler } = require('./src/middleware/errorHandler');

// ─── Load Env & Connect DB ────────────────────────────────────────────────
dotenv.config({ path: path.join(__dirname, '.env') });
connectDB();

const app = express();

// ─── Security & Logging ────────────────────────────────────────────────────
app.use(helmet());
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev')); // colored request logs in terminal
}

// ─── Core Middleware ───────────────────────────────────────────────────────
app.use(cors({
    origin: [
        'https://catering-ops-hub--jamimani19.replit.app',
        'http://localhost:3000',
        'http://localhost:5173',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Import Routes ─────────────────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
// FUTURE ROUTES (uncomment as each step is implemented):
// const menuRoutes       = require('./src/routes/menuRoutes');
// const quoteRoutes      = require('./src/routes/quoteRoutes');
// const orderRoutes      = require('./src/routes/orderRoutes');
// const dashboardRoutes  = require('./src/routes/dashboardRoutes');
// const invoiceRoutes    = require('./src/routes/invoiceRoutes');
// const paymentRoutes    = require('./src/routes/paymentRoutes');
// const calendarRoutes   = require('./src/routes/calendarRoutes');
// const kitchenRoutes    = require('./src/routes/kitchenRoutes');
// const feedbackRoutes   = require('./src/routes/feedbackRoutes');
// const settingsRoutes   = require('./src/routes/settingsRoutes');

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🍽️  Catering Ops Hub API is running',
        version: '1.0.0',
        implemented: [
            'GET/POST  /api/auth',
            'GET/POST/PUT/DELETE  /api/customers',
        ],
    });
});

// ─── Mount Routes ─────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
// FUTURE MOUNTS (uncomment as implemented):
// app.use('/api/menu',      menuRoutes);
// app.use('/api/quotes',    quoteRoutes);
// app.use('/api/orders',    orderRoutes);
// app.use('/api/dashboard', dashboardRoutes);
// app.use('/api/invoices',  invoiceRoutes);
// app.use('/api/payments',  paymentRoutes);
// app.use('/api/calendar',  calendarRoutes);
// app.use('/api/kitchen',   kitchenRoutes);
// app.use('/api/feedback',  feedbackRoutes);
// app.use('/api/settings',  settingsRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
});

// ─── Centralized Error Handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});
