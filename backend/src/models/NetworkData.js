const mongoose = require("mongoose");

const NetworkDataSchema = new mongoose.Schema({
  provider: String,
  signalStrength: Number,
  networkType: String,

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: [Number]
  },

  geohash: String,

  // Granular RF metrics (populated by Android passive sensing engine)
  rsrp: { type: Number, default: null },   // Reference Signal Received Power (dBm), range: -44 to -140
  rsrq: { type: Number, default: null },   // Reference Signal Received Quality (dB)

  // Core anti-survivorship-bias flag: false = device had no data connection at measurement time
  connectivityFlag: { type: Boolean, default: true },

  // Anonymised device identifier for rate-limiting and deduplication
  deviceId: { type: String, default: null },

  timestamp: {
    type: Date,
    default: Date.now
  }
});

NetworkDataSchema.index({ location: "2dsphere" });
NetworkDataSchema.index({ geohash: 1 });
NetworkDataSchema.index({ deviceId: 1, timestamp: -1 }); // For deduplication queries
NetworkDataSchema.index({ connectivityFlag: 1 }); // For dead zone queries

module.exports = mongoose.model("NetworkData", NetworkDataSchema);