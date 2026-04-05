const mongoose = require('mongoose');
require('dotenv').config();
const Feedback = require('./src/models/Feedback');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const result = await Feedback.deleteMany({ customerName: 'Guest' });
    console.log('Deleted ' + result.deletedCount + ' dummy records');
    process.exit(0);
}).catch(console.error);
