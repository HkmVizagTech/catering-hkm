const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./src/models/User');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'mukunda@hkmvizag.org').toLowerCase();
const ADMIN_PASSWORD = 'HKM@143'; // The password we want to set

async function seedAdmin() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        let user = await User.findOne({ email: ADMIN_EMAIL });

        if (user) {
            console.log(`User found: ${ADMIN_EMAIL}. Updating password...`);
            user.password = ADMIN_PASSWORD;
            user.role = 'admin';
            user.isActive = true;
            await user.save();
            console.log('✅ Admin password updated successfully.');
        } else {
            console.log(`User NOT found: ${ADMIN_EMAIL}. Creating new admin...`);
            user = await User.create({
                name: 'Administrator',
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                role: 'admin',
                isActive: true
            });
            console.log('✅ Admin user created successfully.');
        }

        console.log('\n--- Credentials for Login ---');
        console.log(`Email:    ${ADMIN_EMAIL}`);
        console.log(`Password: ${ADMIN_PASSWORD}`);
        console.log('-----------------------------\n');

    } catch (error) {
        console.error('❌ Error seeding admin:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

seedAdmin();
