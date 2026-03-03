
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let dbConnection;

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await client.connect();
    dbConnection = client.db(process.env.DB_NAME || 'network-analyser-db');
    
    // Test the connection
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
    
    return dbConnection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
}

/**
 * Get the database connection
 */
function getDB() {
  if (!dbConnection) {
    throw new Error('Database not connected. Call connectDB first.');
  }
  return dbConnection;
}

/**
 * Close the database connection
 */
async function closeDB() {
  try {
    await client.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error closing database:", error);
    throw error;
  }
}

module.exports = {
  connectDB,
  getDB,
  closeDB,
  client
};
