const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

/**
 * Connect to MongoDB using Mongoose
 */
async function connectDB() {
  try {
    await mongoose.connect(uri, {
      dbName: process.env.DB_NAME || 'network-analyser-db',
    });
    
    console.log("✅ Successfully connected to MongoDB with Mongoose!");
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error("❌ MongoDB connection error:", err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

/**
 * Close the database connection
 */
async function closeDB() {
  try {
    await mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error closing database:", error);
    throw error;
  }
}

module.exports = {
  connectDB,
  closeDB,
};
