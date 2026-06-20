const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('⚠️  MONGO_URI is not set. Skipping MongoDB connection...');
      return;
    }
    // Disable strictPopulate to allow flexible population (useful for complex/legacy queries)
    mongoose.set('strictPopulate', false);
    
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️  Continuing without MongoDB connection...');
  }
};

module.exports = connectDB;
