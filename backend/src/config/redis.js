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
