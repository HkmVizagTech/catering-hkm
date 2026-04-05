const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
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
const menuRoutes = require('./src/routes/menuRoutes');       // Step 3
const quoteRoutes = require('./src/routes/quoteRoutes');     // Step 4
const orderRoutes = require('./src/routes/orderRoutes');      // Step 5
const dashboardRoutes = require('./src/routes/dashboardRoutes');  // Step 6
const invoiceRoutes  = require('./src/routes/invoiceRoutes');   // Step 7
const paymentRoutes  = require('./src/routes/paymentRoutes');   // Step 8
const expenseRoutes  = require('./src/routes/expenseRoutes');   // Step 9
const reportRoutes   = require('./src/routes/reportRoutes');    // Step 10
const calendarRoutes = require('./src/routes/calendarRoutes');  // Step 11
const kitchenRoutes  = require('./src/routes/kitchenRoutes');   // Step 12
const feedbackRoutes = require('./src/routes/feedbackRoutes');  // Step 13
const settingsRoutes = require('./src/routes/settingsRoutes');  // Step 14

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🍽️  Catering Ops Hub API is running',
        version: '1.0.0',
        implemented: [
            'GET/POST                        /api/auth',
            'GET/POST/PUT/DELETE             /api/customers',
            'GET/POST/PUT/DELETE/PATCH       /api/menu',
            'GET/POST/PUT/DELETE             /api/quotes  (+POST /:id/convert)',
            'GET/POST/PUT/PATCH              /api/orders  (+export, +archive)',
            'GET                            /api/dashboard/summary & /stats',
            'GET/POST/PUT/POST               /api/invoices (+pdf, +send, +bulk-export)',
            'GET/POST/PATCH/GET              /api/payments (+razorpay, +summary, +export, +reconcile)',
            'GET/POST/GET/PUT/DELETE         /api/expenses (+summary)',
            'GET                             /api/calendar/events',
            'GET/PATCH                       /api/kitchen/orders (+status, socket.io)',
            'GET/POST                        /api/feedback (+summary, +export)',
            'GET/PUT                         /api/settings (+razorpay config)',
        ],
    });
});

// ─── Mount Routes ─────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/menu', menuRoutes);       // Step 3
app.use('/api/quotes', quoteRoutes);    // Step 4
app.use('/api/orders', orderRoutes);    // Step 5
app.use('/api/dashboard', dashboardRoutes); // Step 6
app.use('/api/invoices',  invoiceRoutes);  // Step 7
app.use('/api/payments', paymentRoutes);   // Step 8
app.use('/api/expenses', expenseRoutes);   // Step 13
app.use('/api/reports', reportRoutes);     // Step 14
app.use('/api/kitchen', kitchenRoutes);    // Step 15
app.use('/api/calendar', calendarRoutes);  // Step 9
app.use('/api/feedback', feedbackRoutes);  // Step 11
app.use('/api/settings', settingsRoutes);  // Step 12
// FUTURE MOUNTS (uncomment as implemented):

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found.`,
    });
});

// ─── Centralized Error Handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ─── Socket.IO Setup ──────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*', // Allows requests from any frontend domain
        methods: ['GET', 'POST', 'PATCH'],
    },
});

io.on('connection', (socket) => {
    console.log(`🟢 Kitchen dashboard connected: ${socket.id}`);
    
    // Optional: could join specific specific department rooms here
    // socket.on('join_department', (dept) => socket.join(dept));

    socket.on('disconnect', () => {
        console.log(`🔴 Kitchen dashboard disconnected: ${socket.id}`);
    });
});

// Make io accessible in our controllers (req.app.get('io'))
app.set('io', io);

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO enabled for Kitchen View`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
});

