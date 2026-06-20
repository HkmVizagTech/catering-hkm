const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../src/models/User');

async function test() {
    console.log('MONGO_URI:', process.env.MONGO_URI ? 'Present' : 'Missing');
    console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
    console.log('ADMIN_PASSWORD_HASH:', process.env.ADMIN_PASSWORD_HASH ? 'Present' : 'Missing');

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const email = process.env.ADMIN_EMAIL || 'mukunda@hkmvizag.org';
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (user) {
            console.log('✅ Admin user found in DB');
        } else {
            console.log('❌ Admin user NOT found in DB. Need to bootstrap.');
            const adminHash = process.env.ADMIN_PASSWORD_HASH;
            if (!adminHash) {
                console.log('❌ ADMIN_PASSWORD_HASH is missing in .env');
            } else {
                console.log('✅ ADMIN_PASSWORD_HASH is present. Ready to bootstrap.');
            }
        }

    } catch (err) {
        console.error('❌ Connection or Query Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

test();
