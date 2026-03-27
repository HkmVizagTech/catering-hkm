require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function testModels() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');
    const modelsPath = path.join(__dirname, 'src', 'models');
    fs.readdirSync(modelsPath).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                require(path.join(modelsPath, file));
                console.log(`Loaded ${file} successfully`);
            } catch(e) {
                console.error(`Error in ${file}:`, e);
            }
        }
    });
    process.exit(0);
}
testModels();
