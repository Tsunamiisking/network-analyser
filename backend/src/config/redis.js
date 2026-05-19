/**
 * redis.js — Redis Client Configuration
 *
 * Creates and exports a singleton Redis client used for caching expensive
 * MongoDB aggregation results (heatmap queries, best-network lookups).
 * Connection target: 127.0.0.1:6379 (overridable via REDIS_HOST / REDIS_PORT env vars).
 * Reconnection strategy: exponential back-off up to 10 retries, then gives up.
 * If Redis is unavailable the app continues without caching — all cache reads
 * and writes are wrapped in try/catch throughout the controllers.
 */
const redis = require("redis");

const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.log("Redis: Too many reconnection attempts, giving up");
        return new Error("Redis reconnection failed");
      }
      return retries * 100; // reconnect after 100ms, 200ms, 300ms, etc.
    }
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

redisClient.on("connect", () => {
  console.log("✓ Redis connected successfully");
});

redisClient.on("ready", () => {
  console.log("✓ Redis ready to use");
});

redisClient.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

// Connect to Redis
let isConnecting = false;
(async () => {
  if (!isConnecting) {
    isConnecting = true;
    try {
      await redisClient.connect();
    } catch (err) {
      console.error("⚠️  Failed to connect to Redis:", err.message);
      console.log("Redis caching disabled - app will continue without Redis");
    }
  }
})();

module.exports = redisClient;
