const mongoose = require('mongoose');
const MenuItem = require('./src/models/MenuItem');
require('dotenv').config();

async function checkCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/higher-taste');
    console.log('Connected to MongoDB');
    
    const items = await MenuItem.find({});
    const categories = [...new Set(items.map(i => i.category))];
    console.log('Unique categories in DB:', categories);
    
    // Check if any item has "Main course"
    const badItems = items.filter(i => i.category === 'Main course');
    if (badItems.length > 0) {
      console.log('Found items with "Main course":', badItems.map(i => i.name));
      // Fix them?
      await MenuItem.updateMany({ category: 'Main course' }, { category: 'Main Course' });
      console.log('Fixed bad categories.');
    } else {
      console.log('No "Main course" items found.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkCategories();
