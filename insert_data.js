const mongoose = require('mongoose');
require('dotenv').config();
const Feedback = require('./src/models/Feedback');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/higher-taste').then(async () => {
    await Feedback.insertMany([
        { orderId: 'ORD-2024-001', customerName: 'Ravi Mehta', rating: 5, comment: 'Excellent food, the Kheer was divine!', tags: ['Quality', 'Service'] },
        { orderId: 'ORD-2024-002', customerName: 'Priya Sharma', rating: 4, comment: 'Timely delivery and very good service.', tags: ['Punctuality', 'Service'] },
        { orderId: 'ORD-2024-003', customerName: 'Arjun Patel', rating: 5, comment: 'The Satvik Thali was beyond expectations.', tags: ['Quality'] },
        { orderId: 'ORD-2024-004', customerName: 'Anita Desai', rating: 4, comment: 'Everything was good but could be a bit warmer.', tags: ['Quality'] }
    ]);
    console.log('Inserted');
    process.exit(0);
}).catch(console.error);
